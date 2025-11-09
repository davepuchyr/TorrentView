"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { ChevronRight, Folder } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Torrent, TorrentFile } from "@/lib/types";
import { Separator } from "./ui/separator";
import { formatBytes, cn } from "@/lib/utils";
import { ScrollArea } from "./ui/scroll-area";

const formSchema = z.object({
   savePath: z.string().min(1, { message: "Save path is required." }),
   paused: z.boolean().default(false),
   addToTop: z.boolean().default(false),
   sequential: z.boolean().default(false),
   firstLastPiecePrio: z.boolean().default(false),
   contentLayout: z.enum(["Original", "Subfolder", "NoSubfolder"]).default("NoSubfolder"),
   selectedFiles: z.set(z.string()),
});

type DownloadOptionsFormValues = z.infer<typeof formSchema>;

interface DownloadOptionsDialogProps {
   backendUrl: string;
   torrent: Torrent | null;
   isOpen: boolean;
   onClose: () => void;
}

type FileTreeNode = {
   name: string;
   path: string;
   size: number;
   children?: Map<string, FileTreeNode>;
   isFile: boolean;
};

const buildFileTree = (files: TorrentFile[]): FileTreeNode => {
   const root: FileTreeNode = { name: "/", path: "/", size: 0, children: new Map(), isFile: false };

   files.forEach(file => {
      let currentNode = root;
      const parts = file.name.split("/");
      parts.forEach((part, index) => {
         if (!currentNode.children) {
            currentNode.children = new Map();
         }
         if (!currentNode.children.has(part)) {
            const isFile = index === parts.length - 1;
            const path = parts.slice(0, index + 1).join("/");
            currentNode.children.set(part, { name: part, path, size: 0, children: isFile ? undefined : new Map(), isFile });
         }

         const childNode = currentNode.children.get(part)!;
         if (index === parts.length - 1) {
            childNode.size = file.size;
         }
         currentNode = childNode;
      });
   });

   const calculateFolderSize = (node: FileTreeNode): number => {
      if (node.isFile) {
         return node.size;
      }
      if (node.children) {
         node.size = Array.from(node.children.values()).reduce((sum, child) => sum + calculateFolderSize(child), 0);
      }
      return node.size;
   };

   calculateFolderSize(root);

   return root;
};

const FileTree = ({
   node,
   level = 0,
   selectedFiles,
   onSelectionChange,
}: {
   node: FileTreeNode;
   level?: number;
   selectedFiles: Set<string>;
   onSelectionChange: (path: string, selected: boolean) => void;
}) => {
   const [isOpen, setIsOpen] = React.useState(level < 1);
   const isSelected = selectedFiles.has(node.path);

   const handleCheckedChange = (checked: boolean) => {
      onSelectionChange(node.path, checked);
   };

   if (node.name === "/" && node.children) {
      return (
         <div>
            {Array.from(node.children.values()).map(child => (
               <FileTree
                  key={child.path}
                  node={child}
                  level={level}
                  selectedFiles={selectedFiles}
                  onSelectionChange={onSelectionChange}
               />
            ))}
         </div>
      );
   }

   const isDirectory = !node.isFile;

   return (
      <div>
         <div className={cn("flex items-center rounded-md p-1 text-sm hover:bg-accent", { "bg-accent/50": isSelected })}>
            <div style={{ paddingLeft: `${level * 1.5}rem` }} className="flex flex-grow items-center truncate">
               <Checkbox id={`file-${node.path}`} checked={isSelected} onCheckedChange={handleCheckedChange} className="mr-2" />
               {isDirectory && (
                  <ChevronRight
                     className={cn("mr-1 h-4 w-4 transition-transform", { "rotate-90": isOpen })}
                     onClick={() => setIsOpen(!isOpen)}
                  />
               )}
               {!isDirectory && <div className="mr-1 w-5" />}
               <label htmlFor={`file-${node.path}`} className="flex flex-grow items-center gap-1 truncate">
                  {isDirectory && <Folder className="h-4 w-4 text-primary" />}
                  {node.name}
               </label>
            </div>
            <div className="pr-2 text-xs tabular-nums text-muted-foreground">{formatBytes(node.size)}</div>
         </div>
         {isDirectory && isOpen && node.children && (
            <div>
               {Array.from(node.children.values()).map(child => (
                  <FileTree
                     key={child.path}
                     node={child}
                     level={level + 1}
                     selectedFiles={selectedFiles}
                     onSelectionChange={onSelectionChange}
                  />
               ))}
            </div>
         )}
      </div>
   );
};

export function DownloadOptionsDialog({ backendUrl, torrent, isOpen, onClose }: DownloadOptionsDialogProps) {
   const { toast } = useToast();
   const fileTree = React.useMemo(() => (torrent?.files ? buildFileTree(torrent.files) : null), [torrent]);
   const allFilePaths = React.useMemo(() => {
      if (!torrent) return [];
      if (!fileTree) return [torrent.name];

      const paths: string[] = [];
      const traverse = (node: FileTreeNode) => {
         paths.push(node.path);
         if (node.children) {
            node.children.forEach(traverse);
         }
      };
      if (fileTree) traverse(fileTree);
      return paths;
   }, [fileTree, torrent]);

   const [selectedFiles, setSelectedFiles] = React.useState(new Set<string>());

   const form = useForm<DownloadOptionsFormValues>({
      resolver: zodResolver(formSchema),
      defaultValues: {
         savePath: "/home/archive/bittorrent",
         paused: false,
         addToTop: false,
         sequential: false,
         firstLastPiecePrio: false,
         contentLayout: "NoSubfolder",
         selectedFiles: new Set<string>(),
      },
   });

   React.useEffect(() => {
      if (!torrent) return; // short-circuit

      const files = new Set(allFilePaths);
      form.reset({
         savePath: "/home/archive/bittorrent",
         paused: false,
         addToTop: false,
         sequential: false,
         firstLastPiecePrio: false,
         contentLayout: "NoSubfolder",
         selectedFiles: files,
      });
      setSelectedFiles(files);
   }, [torrent, form, allFilePaths]);

   const handleSelectionChange = (path: string, selected: boolean) => {
      const newSelectedFiles = new Set(selectedFiles);

      if (!fileTree) {
         // Handle single file case
         if (selected) newSelectedFiles.add(path);
         else newSelectedFiles.delete(path);
         setSelectedFiles(newSelectedFiles);
         return;
      }

      const affectedPaths = new Set<string>();
      const isDeselectingParent = !selected && newSelectedFiles.has(path);

      const findNode = (node: FileTreeNode, targetPath: string): FileTreeNode | null => {
         if (node.path === targetPath) return node;
         if (node.children) {
            for (const child of Array.from(node.children.values())) {
               const found = findNode(child, targetPath);
               if (found) return found;
            }
         }
         return null;
      };

      const startNode = findNode(fileTree, path);
      if (!startNode) return;

      const traverse = (node: FileTreeNode) => {
         affectedPaths.add(node.path);
         if (node.children) {
            node.children.forEach(traverse);
         }
      };

      traverse(startNode);

      affectedPaths.forEach(p => {
         if (selected) newSelectedFiles.add(p);
         else newSelectedFiles.delete(p);
      });

      // If deselecting a child, deselect parents as well
      if (!selected) {
         const parts = path.split("/");
         for (let i = parts.length - 1; i > 0; i--) {
            const parentPath = parts.slice(0, i).join("/");
            newSelectedFiles.delete(parentPath);
         }
      }

      // If selecting a child, ensure all parents are selected
      if (selected) {
         const parts = path.split("/");
         for (let i = 1; i <= parts.length; i++) {
            const parentPath = parts.slice(0, i).join("/");
            newSelectedFiles.add(parentPath);
         }
      }

      setSelectedFiles(newSelectedFiles);
   };

   const onSubmit = async (data: DownloadOptionsFormValues) => {
      if (!torrent) return;

      try {
         const url = `/api/v2/torrents/add?backendUrl=${encodeURIComponent(backendUrl)}`; // HARD-CODED
         const response = await fetch(url, {
            method: "POST",
            body: JSON.stringify({
               torrent,
               data: {
                  ...data,
                  selectedFiles: Array.from(data.selectedFiles),
               },
            }),
         });

         if (response.ok) {
            toast({
               title: "Download Started",
               description: `Downloading "${torrent?.name}"`,
            });
         } else {
            const errorText = await response.text();
            toast({
               variant: "destructive",
               title: "Failed to start download",
               description: errorText || "An unknown error occurred.",
            });
         }
      } catch (error: any) {
         toast({
            variant: "destructive",
            title: "Failed to start download",
            description: error.message || "A network error occurred.",
         });
      }

      onClose();
   };

   if (!torrent) {
      return null;
   }

   const selectedFileCount = torrent.files ? Array.from(selectedFiles).filter(p => !p.endsWith("/")).length : selectedFiles.size;
   const totalFileCount = torrent.files?.length || 1;

   return (
      <Dialog open={isOpen} onOpenChange={onClose}>
         <DialogContent className="sm:max-w-[800px]">
            <DialogHeader>
               <DialogTitle>Download Options for "{torrent.name}"</DialogTitle>
            </DialogHeader>
            <Form {...form}>
               <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-x-8 gap-y-4">
                  {/* Left Column */}
                  <div className="space-y-4">
                     <FormField
                        control={form.control}
                        name="savePath"
                        render={({ field }) => (
                           <FormItem>
                              <FormLabel>Save at</FormLabel>
                              <FormControl>
                                 <Input placeholder="/path/to/downloads" {...field} />
                              </FormControl>
                           </FormItem>
                        )}
                     />

                     <Separator />

                     <h3 className="text-lg font-medium">Torrent options</h3>

                     <div className="grid grid-cols-2 gap-4">
                        <FormField
                           control={form.control}
                           name="paused"
                           render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                 <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                 </FormControl>
                                 <FormLabel className="font-normal">Start torrent paused</FormLabel>
                              </FormItem>
                           )}
                        />

                        <FormField
                           control={form.control}
                           name="addToTop"
                           render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                 <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                 </FormControl>
                                 <FormLabel className="font-normal">Add to top of queue</FormLabel>
                              </FormItem>
                           )}
                        />
                        <FormField
                           control={form.control}
                           name="sequential"
                           render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                 <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                 </FormControl>
                                 <FormLabel className="font-normal">Download in sequential order</FormLabel>
                              </FormItem>
                           )}
                        />
                        <FormField
                           control={form.control}
                           name="firstLastPiecePrio"
                           render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                 <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                 </FormControl>
                                 <FormLabel className="font-normal">Download first and last pieces first</FormLabel>
                              </FormItem>
                           )}
                        />
                     </div>

                     <FormField
                        control={form.control}
                        name="contentLayout"
                        render={({ field }) => (
                           <FormItem>
                              <FormLabel>Content Layout</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                 <FormControl>
                                    <SelectTrigger>
                                       <SelectValue placeholder="Select layout" />
                                    </SelectTrigger>
                                 </FormControl>
                                 <SelectContent>
                                    <SelectItem value="Original">Original</SelectItem>
                                    <SelectItem value="Subfolder">Create subfolder</SelectItem>
                                    <SelectItem value="NoSubfolder">Don't create subfolder</SelectItem>
                                 </SelectContent>
                              </Select>
                           </FormItem>
                        )}
                     />

                     <Separator />

                     <h3 className="text-lg font-medium">Torrent information</h3>
                     <div className="space-y-2 text-sm text-muted-foreground">
                        <p>Size: {torrent.size} (Free space on disk: 17.50 GiB)</p>
                        <p>Date: {new Date(torrent.added_on * 1000).toLocaleDateString()}</p>
                        <p>Comment:</p>
                     </div>

                     <div className="text-sm text-muted-foreground">
                        Metadata retrieval complete{" "}
                        <Button type="button" variant="link" className="h-auto p-0">
                           Save as .torrent file...
                        </Button>
                     </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                     <div className="flex items-center justify-between">
                        <div className="space-x-2">
                           <Button type="button" variant="outline" onClick={() => setSelectedFiles(new Set(allFilePaths))}>
                              Select All
                           </Button>
                           <Button type="button" variant="outline" onClick={() => setSelectedFiles(new Set())}>
                              Select None
                           </Button>
                        </div>
                        <div className="text-sm text-muted-foreground">
                           {selectedFileCount} / {totalFileCount} files selected
                        </div>
                     </div>
                     <ScrollArea className="h-[400px] rounded-md border">
                        <div className="p-1">
                           {fileTree ? (
                              <FileTree node={fileTree} selectedFiles={selectedFiles} onSelectionChange={handleSelectionChange} />
                           ) : (
                              <div className="flex items-center p-4 text-sm">
                                 <Checkbox
                                    id={`file-${torrent.name}`}
                                    checked={selectedFiles.has(torrent.name)}
                                    onCheckedChange={checked => handleSelectionChange(torrent.name, !!checked)}
                                    className="mr-2"
                                 />

                                 <label htmlFor={`file-${torrent.name}`} className="flex-grow">
                                    {torrent.name}
                                 </label>

                                 <div className="text-xs tabular-nums text-muted-foreground">{torrent.size}</div>
                              </div>
                           )}
                        </div>
                     </ScrollArea>
                  </div>

                  <DialogFooter className="col-span-2">
                     <Button type="button" variant="ghost" onClick={onClose}>
                        Cancel
                     </Button>
                     <Button type="submit">OK</Button>
                  </DialogFooter>
               </form>
            </Form>
         </DialogContent>
      </Dialog>
   );
}

"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { SubmitHandler, useForm } from "react-hook-form";
import * as z from "zod";
import { ChevronRight, Folder } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Torrent, TorrentFile, TorrentFileInfo, TorrentMetadata } from "@/lib/types";
import { formatBytes, cn } from "@/lib/utils";
import { ScrollArea } from "./ui/scroll-area";
import { Skeleton } from "./ui/skeleton";

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

const downloadDefaults: DownloadOptionsFormValues = {
   savePath: "/home/archive/bittorrent",
   paused: true,
   addToTop: false,
   sequential: false,
   firstLastPiecePrio: false,
   contentLayout: "NoSubfolder",
   selectedFiles: new Set<string>(),
};

type FileTreeNode = {
   name: string;
   path: string;
   size: number;
   children?: Map<string, FileTreeNode>;
   isFile: boolean;
};

const buildFileTree = (files: TorrentFileInfo[]): FileTreeNode => {
   const root: FileTreeNode = { name: "/", path: "/", size: 0, children: new Map(), isFile: false };

   files.forEach(file => {
      let currentNode = root;
      const parts = file.path;
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
            childNode.size = file.length;
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
   const [files, setFiles] = React.useState<TorrentFileInfo[] | null>(null);
   const [isLoadingFiles, setIsLoadingFiles] = React.useState(false);
   const [selectedFiles, setSelectedFiles] = React.useState(new Set<string>());
   const fileTree = React.useMemo(() => (files ? buildFileTree(files) : null), [files]);
   const allFilePaths = React.useMemo(() => {
      if (!files) return torrent ? [torrent.name] : [];

      const paths: string[] = [];
      const traverse = (node: FileTreeNode) => {
         paths.push(node.path);
         if (node.children) {
            node.children.forEach(traverse);
         }
      };
      if (fileTree) traverse(fileTree);
      return paths;
   }, [fileTree, files, torrent]);

   const form = useForm<DownloadOptionsFormValues>({
      resolver: zodResolver(formSchema),
      defaultValues: downloadDefaults,
   });

   React.useEffect(() => {
      const fetchFiles = async () => {
         if (!torrent || !isOpen || torrent.metadata?.files) return;
         setIsLoadingFiles(true);
         setFiles(null);
         try {
            const url = `/api/metadata?backendUrl=${encodeURIComponent(backendUrl)}&url=${encodeURIComponent(torrent.hash)}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch torrent contents for url ${torrent.hash}.`);

            const metadata: TorrentMetadata = await response.json();
            torrent.metadata = metadata; // NOTE: Quietly add metadata to torrent, ie don't trigger a re-render.
            setFiles(metadata.files);
         } catch (error: any) {
            console.error("Failed to fetch torrent files:", error);
            setFiles(null); // Explicitly set to null to indicate single file mode
            toast({
               variant: "destructive",
               title: "Could not get file list",
               description: error.message || "The backend might not support this feature.",
            });
         } finally {
            setIsLoadingFiles(false);
         }
      };
      fetchFiles();
   }, [torrent, isOpen, backendUrl, toast]);

   React.useEffect(() => {
      if (!torrent) return;

      let initialSelected: Set<string>;
      if (!files && !isLoadingFiles) {
         initialSelected = new Set([torrent.name]);
      } else {
         initialSelected = new Set(allFilePaths);
      }

      form.reset({
         savePath: "/home/archive/bittorrent",
         paused: false,
         addToTop: false,
         sequential: false,
         firstLastPiecePrio: false,
         contentLayout: "NoSubfolder",
         selectedFiles: initialSelected,
      });
      setSelectedFiles(initialSelected);
   }, [torrent, files, isLoadingFiles, allFilePaths, form]);

   const handleSelectionChange = (path: string, selected: boolean) => {
      const newSelectedFiles = new Set(selectedFiles);

      if (!fileTree) {
         if (selected) newSelectedFiles.add(path);
         else newSelectedFiles.delete(path);
         form.setValue("selectedFiles", newSelectedFiles);
         setSelectedFiles(newSelectedFiles);
         return;
      }

      const affectedPaths = new Set<string>();
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

      if (!selected) {
         const parts = path.split("/");
         for (let i = parts.length - 1; i > 0; i--) {
            const parentPath = parts.slice(0, i).join("/");
            newSelectedFiles.delete(parentPath);
         }
      }

      if (selected) {
         const parts = path.split("/");
         for (let i = 1; i <= parts.length; i++) {
            const parentPath = parts.slice(0, i).join("/");
            if (allFilePaths.includes(parentPath)) {
               newSelectedFiles.add(parentPath);
            }
         }
      }

      form.setValue("selectedFiles", newSelectedFiles);
      setSelectedFiles(newSelectedFiles);
   };

   const onSubmit = async (data: DownloadOptionsFormValues) => {
      if (!torrent) return;

      const selectedFileNames = new Set<string>();
      if (files) {
         const filePaths = files.map(f => f.path.join("/"));
         for (const selectedPath of data.selectedFiles) {
            if (filePaths.includes(selectedPath)) {
               selectedFileNames.add(selectedPath);
            }
         }
      } else {
         if (data.selectedFiles.has(torrent.name)) {
            selectedFileNames.add(torrent.name);
         }
      }
      try {
         const url = `/api/v2/torrents/add?backendUrl=${encodeURIComponent(backendUrl)}`;
         const response = await fetch(url, {
            body: JSON.stringify({
               torrent,
               data: {
                  ...data,
                  selectedFiles: Array.from(selectedFileNames),
               },
            }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
         });

         if (response.ok) {
            toast({
               title: "Download started",
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

   if (!torrent) return null; // short-circuit

   const selectedFileCount =
      files && fileTree
         ? Array.from(selectedFiles).filter(path => {
              const node = findNode(fileTree, path);
              return node && node.isFile;
           }).length
         : selectedFiles.size;

   const totalFileCount = files?.length || 1;

   function findNode(node: FileTreeNode, path: string): FileTreeNode | null {
      if (node.path === path) return node;
      if (node.children) {
         for (const child of node.children.values()) {
            const found = findNode(child, path);
            if (found) return found;
         }
      }
      return null;
   }

   const handleSelectAll = () => {
      const all = new Set(allFilePaths);
      setSelectedFiles(all);
      form.setValue("selectedFiles", all);
   };

   const handleSelectNone = () => {
      setSelectedFiles(new Set());
      form.setValue("selectedFiles", new Set());
   };

   return (
      <Dialog open={isOpen} onOpenChange={onClose}>
         <DialogContent className="max-w-[90vw]">
            <DialogHeader>
               <DialogTitle>Download Options for "{torrent.name}"</DialogTitle>
            </DialogHeader>
            <DialogDescription>
               Size: <span className="font-bold">{torrent.size}</span> Date:{" "}
               <span className="font-bold">{new Date(torrent.added_on * 1000).toISOString()}</span>
            </DialogDescription>
            <Form {...form}>
               <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-3 gap-x-8 gap-y-4">
                  {/* Left Column */}
                  <div className="col-span-1 space-y-4">
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
                        name="savePath"
                        render={({ field }) => (
                           <FormItem>
                              <FormLabel>Destination directory</FormLabel>
                              <FormControl>
                                 <Input placeholder="/path/to/downloads" {...field} />
                              </FormControl>
                           </FormItem>
                        )}
                     />

                     <FormField
                        control={form.control}
                        name="contentLayout"
                        render={({ field }) => (
                           <FormItem>
                              <FormLabel>Content layout</FormLabel>
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
                  </div>

                  {/* Right Column */}
                  <div className="col-span-2 space-y-4">
                     <div className="flex items-center justify-between">
                        <div className="space-x-2">
                           <Button type="button" variant="outline" onClick={handleSelectAll}>
                              Select All
                           </Button>
                           <Button type="button" variant="outline" onClick={handleSelectNone}>
                              Select None
                           </Button>
                        </div>
                        <div className="text-sm text-muted-foreground">
                           {selectedFileCount} / {totalFileCount} files selected
                        </div>
                     </div>
                     <ScrollArea className="h-[400px] rounded-md border">
                        <div className="w-full overflow-x-auto p-1">
                           <div className="min-w-max">
                              {isLoadingFiles ? (
                                 <div className="space-y-2 p-4">
                                    <Skeleton className="h-6 w-3/4" />
                                    <Skeleton className="h-6 w-1/2" />
                                    <Skeleton className="h-6 w-5/6" />
                                 </div>
                              ) : fileTree ? (
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
                        </div>
                     </ScrollArea>
                  </div>

                  <DialogFooter className="col-span-3">
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

    
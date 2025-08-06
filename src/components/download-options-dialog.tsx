"use client";

import * as React from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Torrent } from "@/lib/types";
import { Separator } from './ui/separator';
import { formatBytes } from '@/lib/utils';

const formSchema = z.object({
  torrentManagementMode: z.string().default("Manual"),
  savePath: z.string().min(1, { message: "Save path is required." }),
  useAnotherPath: z.boolean().default(false),
  incompletePath: z.string().optional(),
  rememberSavePath: z.boolean().default(false),
  startTorrent: z.boolean().default(true),
  stopCondition: z.string().default("None"),
  addToTop: z.boolean().default(false),
  skipChecking: z.boolean().default(false),
  downloadSequential: z.boolean().default(false),
  downloadFirstLast: z.boolean().default(false),
  doNotDeleteTorrentFile: z.boolean().default(false),
  contentLayout: z.enum(["Original", "Subfolder", "NoSubfolder"]).default("NoSubfolder"),
});

type DownloadOptionsFormValues = z.infer<typeof formSchema>;

interface DownloadOptionsDialogProps {
  torrent: Torrent | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DownloadOptionsDialog({
  torrent,
  isOpen,
  onClose,
}: DownloadOptionsDialogProps) {
  const { toast } = useToast();
  
  const form = useForm<DownloadOptionsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      torrentManagementMode: "Manual",
      savePath: "/home/archive/bittorrent",
      useAnotherPath: false,
      incompletePath: "",
      rememberSavePath: false,
      startTorrent: true,
      stopCondition: "None",
      addToTop: false,
      skipChecking: false,
      downloadSequential: false,
      downloadFirstLast: false,
      doNotDeleteTorrentFile: false,
      contentLayout: "NoSubfolder",
    },
  });

  React.useEffect(() => {
    if (torrent) {
      form.reset({
        torrentManagementMode: "Manual",
        savePath: "/home/archive/bittorrent",
        useAnotherPath: false,
        incompletePath: "",
        rememberSavePath: false,
        startTorrent: true,
        stopCondition: "None",
        addToTop: false,
        skipChecking: false,
        downloadSequential: false,
        downloadFirstLast: false,
        doNotDeleteTorrentFile: false,
        contentLayout: "NoSubfolder",
      });
    }
  }, [torrent, form]);

  const onSubmit = (data: DownloadOptionsFormValues) => {
    // In a real app, this would trigger a backend API call with the selected options.
    console.log("Download options:", data);
    toast({
      title: "Download Started",
      description: `Downloading "${torrent?.name}" with custom options.`,
    });
    onClose();
  };

  if (!torrent) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Download Options for "{torrent.name}"</DialogTitle>
          <DialogDescription>
            Configure settings before starting the download.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-x-8 gap-y-4">
            {/* Left Column */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="torrentManagementMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Torrent Management Mode</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a mode" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Manual">Manual</SelectItem>
                        <SelectItem value="Automatic">Automatic</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

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
              
              <FormField
                control={form.control}
                name="useAnotherPath"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none w-full">
                      <FormLabel>
                        Use another path for incomplete torrent
                      </FormLabel>
                      {field.value && (
                        <FormField
                            control={form.control}
                            name="incompletePath"
                            render={({ field }) => (
                                <FormItem className="mt-2">
                                    <FormControl>
                                        <Input placeholder="/path/to/incomplete" {...field} />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                      )}
                    </div>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="rememberSavePath"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">
                      Remember last used save path
                    </FormLabel>
                  </FormItem>
                )}
              />

              <Separator />

              <h3 className="text-lg font-medium">Torrent options</h3>
              

              <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startTorrent"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="font-normal">Start torrent</FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormItem>
                    <FormLabel>Stop condition</FormLabel>
                    <Select onValueChange={form.setValue.bind(form, 'stopCondition')} defaultValue={form.getValues('stopCondition')}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="None" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="None">None</SelectItem>
                            <SelectItem value="Metadata">Metadata received</SelectItem>
                            <SelectItem value="Files">Files checked</SelectItem>
                        </SelectContent>
                    </Select>
                  </FormItem>

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
                    name="skipChecking"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="font-normal">Skip hash check</FormLabel>
                      </FormItem>
                    )}
                  />
                   <FormField
                    control={form.control}
                    name="downloadSequential"
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
                    name="downloadFirstLast"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="font-normal">Download first and last pieces first</FormLabel>
                      </FormItem>
                    )}
                  />
                   <FormField
                    control={form.control}
                    name="doNotDeleteTorrentFile"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="font-normal">Do not delete .torrent file</FormLabel>
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

            </div>

            {/* Right Column */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <div className="space-x-2">
                        <Button type="button" variant="outline">Select All</Button>
                        <Button type="button" variant="outline">Select None</Button>
                    </div>
                </div>
                <div className="border rounded-md h-64 overflow-y-auto">
                    {/* This would be a file tree component in a real app */}
                    <div className="p-4 text-sm">
                        <Checkbox id="file" defaultChecked />
                        <label htmlFor="file" className="ml-2">{torrent.name}</label>
                        <div className="pl-6 text-muted-foreground">
                            {formatBytes(torrent.size)}
                        </div>
                    </div>
                </div>

                <Separator />
                
                <h3 className="text-lg font-medium">Torrent information</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                    <p>Size: {formatBytes(torrent.size)} (Free space on disk: 17.50 GiB)</p>
                    <p>Date: Not available</p>
                    <p>Comment:</p>
                </div>
                
                <div className="text-sm text-muted-foreground">
                    Metadata retrieval complete <Button type="button" variant="link" className="p-0 h-auto">Save as .torrent file...</Button>
                </div>
            </div>

            <DialogFooter className="col-span-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit">OK</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

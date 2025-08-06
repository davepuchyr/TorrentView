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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import type { Torrent } from "@/lib/types";

const formSchema = z.object({
  savePath: z.string().min(1, { message: "Save path is required." }),
  category: z.string().optional(),
  startTorrent: z.boolean().default(true),
  contentLayout: z.enum(["Original", "Subfolder", "NoSubfolder"]).default("Original"),
  skipChecking: z.boolean().default(false),
  createSubfolder: z.boolean().default(true),
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
      savePath: "/downloads/",
      category: torrent?.category || "",
      startTorrent: true,
      contentLayout: "Subfolder",
      skipChecking: false,
      createSubfolder: true,
    },
  });

  React.useEffect(() => {
    if (torrent) {
      form.reset({
        savePath: "/downloads/",
        category: torrent.category,
        startTorrent: true,
        contentLayout: "Subfolder",
        skipChecking: false,
        createSubfolder: true,
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
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Download Options for "{torrent.name}"</DialogTitle>
          <DialogDescription>
            Configure settings before starting the download.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Movies, Series" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contentLayout"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Content Layout</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="Original" />
                          </FormControl>
                          <FormLabel className="font-normal">Original</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="Subfolder" />
                          </FormControl>
                          <FormLabel className="font-normal">Create subfolder</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value="NoSubfolder" />
                          </FormControl>
                          <FormLabel className="font-normal">Don't create subfolder</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex flex-col space-y-3">
                <FormField
                    control={form.control}
                    name="startTorrent"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                            <FormLabel>Start torrent</FormLabel>
                            <FormDescription>
                            Start the torrent immediately after adding it.
                            </FormDescription>
                        </div>
                        <FormControl>
                            <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            />
                        </FormControl>
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="skipChecking"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                            <FormLabel>Skip hash check</FormLabel>
                             <FormDescription>
                                Useful for re-seeding a torrent.
                            </FormDescription>
                        </div>
                        <FormControl>
                            <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            />
                        </FormControl>
                        </FormItem>
                    )}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit">Start Download</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

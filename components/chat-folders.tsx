'use client';

import { useState } from 'react';
import { ChevronDownIcon, FileIcon, PlusIcon } from '@/components/icons';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface ChatFolder {
  id: string;
  name: string;
  chatCount: number;
  isExpanded: boolean;
}

const defaultFolders: ChatFolder[] = [
  {
    id: 'recent',
    name: 'Recent Chats',
    chatCount: 0,
    isExpanded: true,
  },
  {
    id: 'work',
    name: 'Work',
    chatCount: 0,
    isExpanded: false,
  },
  {
    id: 'personal',
    name: 'Personal',
    chatCount: 0,
    isExpanded: false,
  },
  {
    id: 'projects',
    name: 'Projects',
    chatCount: 0,
    isExpanded: false,
  },
];

export function ChatFolders() {
  const [folders, setFolders] = useState<ChatFolder[]>(defaultFolders);

  const toggleFolder = (folderId: string) => {
    setFolders((prev) =>
      prev.map((folder) =>
        folder.id === folderId
          ? { ...folder, isExpanded: !folder.isExpanded }
          : folder,
      ),
    );
  };

  const addNewFolder = () => {
    const newFolder: ChatFolder = {
      id: `folder-${Date.now()}`,
      name: 'New Folder',
      chatCount: 0,
      isExpanded: false,
    };
    setFolders((prev) => [...prev, newFolder]);
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="flex items-center justify-between">
        <span>Chat Folders</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={addNewFolder}
        >
          <PlusIcon size={12} />
        </Button>
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {folders.map((folder) => (
            <Collapsible
              key={folder.id}
              open={folder.isExpanded}
              onOpenChange={() => toggleFolder(folder.id)}
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton className="w-full justify-between">
                    <div className="flex items-center gap-2">
                      <FileIcon size={16} />
                      <span className="truncate">{folder.name}</span>
                      {folder.chatCount > 0 && (
                        <span className="text-muted-foreground text-xs">
                          ({folder.chatCount})
                        </span>
                      )}
                    </div>
                    <div
                      className={`transition-transform ${
                        folder.isExpanded ? 'rotate-180' : ''
                      }`}
                    >
                      <ChevronDownIcon size={14} />
                    </div>
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent className="ml-4">
                  {/* Placeholder for folder contents - would show chats in this folder */}
                  <div className="py-1 text-muted-foreground text-xs">
                    {folder.chatCount === 0
                      ? 'No chats yet'
                      : `${folder.chatCount} chats`}
                  </div>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

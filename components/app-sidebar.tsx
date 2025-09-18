'use client';

import { useRouter } from 'next/navigation';

import { PlusIcon, MessageIcon } from '@/components/icons';
import { SidebarHistory } from '@/components/sidebar-history';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from '@/components/ui/sidebar';
import Link from 'next/link';

export function AppSidebar() {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar className="group-data-[side=left]:border-r-0">
      <SidebarHeader className="border-sidebar-border border-b">
        <SidebarMenu>
          <div className="flex flex-row items-center justify-between p-2">
            <Link
              href="/"
              onClick={() => {
                setOpenMobile(false);
              }}
              className="flex flex-row items-center gap-3"
            >
              <span className="text-sidebar-foreground">
                <MessageIcon size={20} />
              </span>
              <span className="cursor-pointer rounded-md px-2 font-semibold text-lg text-sidebar-foreground hover:bg-sidebar-accent">
                Chatbot
              </span>
            </Link>
          </div>
        </SidebarMenu>
      </SidebarHeader>

      {/* Floating New Chat Button */}
      <div className="absolute top-16 right-4 left-4 z-10">
        <Button
          variant="outline"
          className="w-full border-sidebar-border bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar-accent/80"
          onClick={() => {
            setOpenMobile(false);
            router.push('/');
            router.refresh();
          }}
        >
          <PlusIcon size={16} />
          New Chat
        </Button>
      </div>

      <SidebarContent className="pt-20">
        <div className="px-2 py-2">
          <div className="mb-2 font-medium text-sidebar-foreground/70 text-xs">
            Recent Chats
          </div>
          <SidebarHistory />
        </div>
      </SidebarContent>

      <SidebarFooter className="border-sidebar-border border-t">
        <SidebarUserNav />
      </SidebarFooter>
    </Sidebar>
  );
}

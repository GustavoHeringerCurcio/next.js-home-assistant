"use client"

import {
  Bot,
  Plus,
  Lightbulb,
  Wifi,
  History,
  MessageSquare
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function AppSidebar() {
  return (
    <Sidebar className="border-r border-border bg-sidebar text-sidebar-foreground">
      <SidebarHeader className="h-16 flex items-center justify-between border-b px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bot className="size-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-none text-foreground">Tuya Agent</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">Local AI Assistant</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex flex-col gap-4 p-3">
        {/* Actions */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive>
                  <a href="/" className="flex items-center gap-3 w-full">
                    <Plus className="size-4" />
                    <span>New Chat</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Devices Overview Placeholder */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Tuya Devices
          </SidebarGroupLabel>
          <SidebarGroupContent className="mt-1">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton disabled className="flex items-center gap-3 opacity-90 cursor-default">
                  <Lightbulb className="size-4 text-amber-500 shrink-0" />
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-medium leading-none">WiFi Lamp</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">Online</span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* History Placeholder */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Recent Chats
          </SidebarGroupLabel>
          <SidebarGroupContent className="mt-1">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton disabled className="flex items-center gap-3 opacity-60 cursor-default">
                  <MessageSquare className="size-4 shrink-0" />
                  <span className="text-xs italic">No recent chats</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-3 shrink-0">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                U
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-xs font-medium leading-none text-foreground">Local User</span>
              <span className="text-[10px] text-muted-foreground mt-0.5">tuya-agent</span>
            </div>
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
            <Wifi className="size-3 animate-pulse" />
            <span className="text-[9px] font-semibold uppercase">Connected</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

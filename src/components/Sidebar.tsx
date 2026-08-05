import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  Menu,
  Plus,
  LogOut,
  Crown,
  Settings,
  LayoutGrid,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { BILLING_URL } from '@/config/billing';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useQuery } from '@tanstack/react-query';
import { ConditionalWrapper } from './ConditionalWrapper';
import { cn } from '@/lib/utils';
import { Conversation } from '@shared/types';
import { UserAvatar } from '@/components/chat/UserAvatar';
import { useProfile } from '@/services/profileService';
import { useDeleteConversation } from '@/hooks/useDeleteConversation';

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
}

type SidebarPath = '/' | '/history';

function DesktopSidebar({ isSidebarOpen, setIsSidebarOpen }: SidebarProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { data: profile } = useProfile();
  const deleteConversation = useDeleteConversation();

  // Get 10 most recent conversations
  const { data: recentConversations } = useQuery<Conversation[]>({
    queryKey: ['conversations', 'recent'],
    initialData: [],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('updated_at', { ascending: false })
        .eq('user_id', user?.id ?? '')
        .limit(10)
        .overrideTypes<Conversation[]>();

      if (error) throw error;

      return data;
    },
  });

  const handleSignOut = async () => {
    // Local guest mode — nothing to sign out of.
  };

  const sidebarNavigate = (path: SidebarPath) => {
    if (isMobile) {
      setIsSidebarOpen(false); // setIsSidebarOpen is actually setOpen from Sheet component
    }
    navigate({ to: path });
  };

  const renderUserSectionTrigger = () => {
    if (isSidebarOpen) {
      return (
        <div className="flex cursor-pointer items-center space-x-3 rounded-md px-2 py-1.5 transition-colors hover:bg-accent-foreground">
          <UserAvatar />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-adam-text-primary">
              {profile?.full_name || user?.email?.split('@')[0] || 'User'}
            </span>
            <span className="text-xs text-adam-text-tertiary dark:text-gray-400">
              {user?.email}
            </span>
          </div>
        </div>
      );
    }

    return (
      <Button
        variant="adam_dark_collapsed_avatar"
        className="group ml-[1px] h-[46px] w-[46px] px-0 py-6"
      >
        <UserAvatar className="h-[30px] w-[30px] transition-all duration-200 ease-in-out group-hover:h-[26px] group-hover:w-[26px] group-hover:ring-2 group-hover:ring-adam-neutral-500" />
      </Button>
    );
  };

  return (
    <div
      className={`${isSidebarOpen ? 'w-64' : 'w-16'} flex h-full flex-shrink-0 flex-col bg-adam-bg-dark pb-2 transition-all duration-300 ease-in-out dark:bg-gray-950`}
    >
      <div className="p-4 dark:border-gray-800">
        <ConditionalWrapper
          condition={!isSidebarOpen}
          wrapper={(children) => (
            <Tooltip>
              <TooltipTrigger asChild>{children}</TooltipTrigger>
              <TooltipContent side="right" className="flex flex-col">
                <span className="font-semibold">Home</span>
                <span className="text-xs text-muted-foreground">Home Page</span>
              </TooltipContent>
            </Tooltip>
          )}
        >
          <button
            type="button"
            className="flex w-full cursor-pointer items-center space-x-2"
            onClick={() => sidebarNavigate('/')}
          >
            {isSidebarOpen ? (
              <div className="flex w-full items-center gap-2 px-1">
                <img
                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                  src={`${import.meta.env.BASE_URL}/kele-logo.png`}
                  alt="Kele"
                />
                <span className="text-lg font-semibold tracking-tight text-adam-text-primary">
                  Kele
                </span>
              </div>
            ) : (
              <img
                src={`${import.meta.env.BASE_URL}/kele-logo-icon.png`}
                alt="Kele"
                className="h-8 w-8 min-w-8 rounded-full object-cover"
              />
            )}
          </button>
        </ConditionalWrapper>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className={`${isSidebarOpen ? 'px-4' : 'px-2'} flex-1 py-2 transition-all duration-300 ease-in-out`}
        >
          <ConditionalWrapper
            condition={!isSidebarOpen}
            wrapper={(children) => (
              <Tooltip>
                <TooltipTrigger asChild>{children}</TooltipTrigger>
                <TooltipContent side="right" className="flex flex-col">
                  <span className="font-semibold">New Creation</span>
                  <span className="text-xs text-muted-foreground">
                    Start a new conversation
                  </span>
                </TooltipContent>
              </Tooltip>
            )}
          >
            <div className="ml-[9px]">
              <Button
                variant="secondary"
                className={` ${
                  isSidebarOpen
                    ? 'flex w-[216px] items-center justify-start gap-2 rounded-[100px] border border-adam-blue bg-adam-background-1 px-4 py-3 text-adam-neutral-100 hover:bg-adam-blue/40 hover:text-adam-text-primary'
                    : 'flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border-2 border-adam-blue bg-adam-background-2 p-[2px] text-adam-neutral-100 shadow-[0px_4px_10px_0px_rgba(126,200,255,0.28)] hover:bg-adam-blue/40 hover:text-adam-text-primary'
                } mb-4`}
                onClick={() => sidebarNavigate('/')}
              >
                <Plus
                  className={`h-5 w-5 ${!isSidebarOpen ? 'text-adam-neutral-300 hover:text-adam-text-primary' : ''}`}
                />
                {isSidebarOpen && (
                  <div className="text-sm font-semibold leading-[14px] tracking-[-0.14px] text-adam-neutral-200">
                    New Creation
                  </div>
                )}
              </Button>
            </div>
          </ConditionalWrapper>
          <nav className="space-y-1">
            {[
              {
                icon: LayoutGrid,
                label: 'Creations',
                href: '/history' as const,
                description: 'View past creations',
                submenu: recentConversations,
              },
            ].map(({ icon: Icon, label, href, description, submenu }) => (
              <div key={label} className="space-y-1">
                <ConditionalWrapper
                  condition={!isSidebarOpen}
                  wrapper={(children) => (
                    <Tooltip>
                      <TooltipTrigger asChild>{children}</TooltipTrigger>
                      <TooltipContent side="right" className="flex flex-col">
                        <span className="font-semibold">{label}</span>
                        <span className="text-xs text-muted-foreground">
                          {description}
                        </span>
                      </TooltipContent>
                    </Tooltip>
                  )}
                >
                  <Button
                    variant={
                      isSidebarOpen ? 'adam_dark' : 'adam_dark_collapsed'
                    }
                    onClick={() => sidebarNavigate(href)}
                    className={`${isSidebarOpen ? 'w-full justify-start' : 'ml-[1px] h-[46px] w-[46px] p-0'}`}
                  >
                    <Icon
                      className={`${isSidebarOpen ? 'mr-2' : ''} h-[22px] w-[22px] min-w-[22px]`}
                    />
                    {isSidebarOpen && label}
                  </Button>
                </ConditionalWrapper>
                {isSidebarOpen && submenu && (
                  <ul className="ml-7 flex list-none flex-col gap-1 border-l border-adam-neutral-500 px-2">
                    {submenu.map(
                      (
                        conversation: Omit<
                          Conversation,
                          'message_count' | 'last_message_at'
                        >,
                      ) => {
                        return (
                          <li
                            key={conversation.id}
                            className="group/item flex items-center gap-0.5"
                          >
                            <Link
                              to="/editor/$id"
                              params={{ id: conversation.id }}
                              className="min-w-0 flex-1"
                              onClick={() => {
                                if (isMobile) {
                                  setIsSidebarOpen(false);
                                }
                              }}
                            >
                              <span className="line-clamp-1 block text-ellipsis text-nowrap rounded-md p-1 text-xs font-medium text-adam-neutral-400 transition-colors duration-200 ease-in-out [@media(hover:hover)]:hover:bg-adam-neutral-950 [@media(hover:hover)]:hover:text-adam-neutral-10">
                                {conversation.title}
                              </span>
                            </Link>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button
                                  type="button"
                                  aria-label={`Delete ${conversation.title}`}
                                  className="shrink-0 rounded p-1 text-adam-neutral-500 opacity-0 transition-opacity hover:bg-adam-neutral-950 hover:text-red-400 focus-visible:opacity-100 group-hover/item:opacity-100"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="border-[2px] border-adam-neutral-700 bg-adam-background-1">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-adam-neutral-100">
                                    Delete Conversation
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete “
                                    {conversation.title}”? This cannot be
                                    undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      deleteConversation.mutate(conversation.id)
                                    }
                                    className="bg-red-600 hover:bg-red-700 dark:bg-red-900 dark:hover:bg-red-800"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </li>
                        );
                      },
                    )}
                  </ul>
                )}
              </div>
            ))}
          </nav>
        </div>

        <div
          className={`${isSidebarOpen ? 'px-4' : 'px-2'} py-4 transition-all duration-300 ease-in-out dark:border-gray-800`}
        >
          <div className={cn('flex flex-col gap-2', isSidebarOpen && 'gap-3')}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                {renderUserSectionTrigger()}
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56"
                align="end"
                side={isMobile ? 'top' : 'right'}
              >
                <div className="flex items-center space-x-2 p-2">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium text-adam-text-primary">
                      {profile?.full_name ||
                        user?.email?.split('@')[0] ||
                        'User'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuGroup className="text-adam-text-primary">
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="flex items-center">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a
                      href={BILLING_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center"
                    >
                      <Crown className="mr-2 h-4 w-4" />
                      <span>Subscriptions</span>
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4 text-adam-text-primary" />
                  <span className="text-adam-text-primary">Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileSidebar({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isSidebarOpen,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setIsSidebarOpen,
}: SidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="fixed left-2 top-2.5 z-50 hover:bg-adam-neutral-700 md:hidden"
        >
          <Menu className="h-5 w-5 text-adam-text-primary" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="bg-adam-bg-dark p-0 [&>button]:text-white"
      >
        {/* For aria stuff */}
        <SheetHeader className="hidden">
          <SheetTitle className="text-adam-text-primary">Kele</SheetTitle>
          <SheetDescription>
            AI-powered microneedle array patch design software
          </SheetDescription>
        </SheetHeader>
        <DesktopSidebar isSidebarOpen={true} setIsSidebarOpen={setOpen} />
      </SheetContent>
    </Sheet>
  );
}

export function Sidebar({ isSidebarOpen, setIsSidebarOpen }: SidebarProps) {
  const isMobile = useIsMobile();
  const { user } = useAuth();

  // Don't display the sidebar if the user isn't logged in
  if (user == null) {
    return <></>;
  }

  return isMobile ? (
    <MobileSidebar
      isSidebarOpen={isSidebarOpen}
      setIsSidebarOpen={setIsSidebarOpen}
    />
  ) : (
    <DesktopSidebar
      isSidebarOpen={isSidebarOpen}
      setIsSidebarOpen={setIsSidebarOpen}
    />
  );
}

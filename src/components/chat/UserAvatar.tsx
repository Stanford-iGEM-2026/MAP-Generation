import { useAuth } from '@/contexts/AuthContext';
import { useProfile, useAvatarUrl } from '@/services/profileService';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';

export function UserAvatar({ className }: { className?: string }) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: avatarUrl } = useAvatarUrl(profile?.avatar_path);

  const metadata = user?.user_metadata as
    | { avatar_url?: string; picture?: string }
    | undefined;
  const providerAvatar = metadata?.avatar_url || metadata?.picture;
  const src = avatarUrl || providerAvatar || undefined;

  return (
    <Avatar className={className}>
      <AvatarImage src={src} />
      <AvatarFallback>{getInitials(profile?.full_name || null)}</AvatarFallback>
    </Avatar>
  );
}

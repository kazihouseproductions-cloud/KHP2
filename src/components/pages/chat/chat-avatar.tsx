import { Icon } from "@/components/ui/icon";
import { MemberAvatar } from "@/components/ui/member-avatar";
import type { ChatThread } from "@/lib/chat";

export function ChatAvatar({ thread }: { thread: ChatThread }) {
  return thread.member ? (
    <MemberAvatar member={thread.member} />
  ) : (
    <span aria-hidden="true" className="member-avatar bg-blue-100 text-blue-700">
      <Icon name="people" size={20} />
    </span>
  );
}

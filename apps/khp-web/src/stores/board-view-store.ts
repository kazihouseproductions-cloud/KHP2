import { create } from "zustand";
import type { Member } from "@/lib/members";

type BoardView = {
  memberId: Member["id"] | null;
  selectMember: (id: Member["id"] | null) => void;
};

export const useBoardViewStore = create<BoardView>((set) => ({
  memberId: null,
  selectMember: (memberId) => set({ memberId }),
}));

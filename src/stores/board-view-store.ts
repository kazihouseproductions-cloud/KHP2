import { create } from "zustand";
import type { DemoMember } from "@/lib/members";

type BoardView = {
  memberId: DemoMember["id"] | null;
  selectMember: (id: DemoMember["id"] | null) => void;
};

export const useBoardViewStore = create<BoardView>((set) => ({
  memberId: null,
  selectMember: (memberId) => set({ memberId }),
}));

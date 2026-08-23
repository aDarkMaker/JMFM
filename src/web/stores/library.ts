import {create} from 'zustand';

interface LibraryItem {
  albumId: number;
  title: string;
  chapterCount: number;
}

interface LibraryState {
  items: LibraryItem[];
}

export const useLibraryStore = create<LibraryState>(() => ({
  items: [],
}));

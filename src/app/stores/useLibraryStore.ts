import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';

export interface LibraryAlbum {
  albumId: number;
  title: string;
  author?: string;
  pdfPath?: string;
  addedAt: number;
}

interface LibraryState {
  albums: LibraryAlbum[];
  load: () => Promise<void>;
  add: (album: LibraryAlbum) => Promise<void>;
  remove: (albumId: number) => Promise<void>;
}

const KEY = 'jmf.library';

export const useLibraryStore = create<LibraryState>((set, get) => ({
  albums: [],
  load: async () => {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      return;
    }
    try {
      set({albums: JSON.parse(raw) as LibraryAlbum[]});
    } catch {
      // ignore corrupted cache
    }
  },
  add: async album => {
    const next = [
      album,
      ...get().albums.filter(a => a.albumId !== album.albumId),
    ];
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    set({albums: next});
  },
  remove: async albumId => {
    const next = get().albums.filter(a => a.albumId !== albumId);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    set({albums: next});
  },
}));

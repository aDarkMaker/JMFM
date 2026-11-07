import type {AlbumSummary} from '../../core/model';
import {formatRelativeTime} from '../util/relativeTime';
import {AlbumRow} from './AlbumRow';

export interface UpdateListProps {
  albums: AlbumSummary[];
  onPress: (album: AlbumSummary) => void;
}

/** Recently updated albums with a relative timestamp per row. */
export function UpdateList({albums, onPress}: UpdateListProps) {
  if (albums.length === 0) return null;

  return (
    <div className="album-list">
      {albums.map((album) => (
        <AlbumRow
          key={album.albumId}
          album={album}
          onPress={onPress}
          meta={formatRelativeTime(album.updateAt) || undefined}
          metaIcon="schedule"
          chevron
        />
      ))}
    </div>
  );
}

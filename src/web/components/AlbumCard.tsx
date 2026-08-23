import {MockAlbum} from '../../data/mock';

export interface AlbumCardProps {
  album: MockAlbum;
  onPress?: (album: MockAlbum) => void;
}

export function AlbumCard({album, onPress}: AlbumCardProps) {
  return (
    <button
      className="album-card"
      onClick={() => onPress?.(album)}
      aria-label={album.title}
    >
      <div className="album-cover" style={{background: album.coverColor}}>
        <span className="cover-title">{album.title.slice(0, 4)}</span>
      </div>
      <div className="album-info">
        <span className="album-title">{album.title}</span>
        <div className="album-meta">
          <span>{album.chapterCount}话</span>
          <span>·</span>
          <span>{album.author}</span>
        </div>
      </div>
    </button>
  );
}

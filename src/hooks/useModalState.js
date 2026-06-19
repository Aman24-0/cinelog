import { createSignal } from 'solid-js';

export function useModalState() {
  const [searchModal, setSearchModal] = createSignal(false);
  const [searchInitialQuery, setSearchInitialQuery] = createSignal('');
  const [detailsId, setDetailsId] = createSignal(null);
  const [previewSource, setPreviewSource] = createSignal(null);
  const [settingsModal, setSettingsModal] = createSignal(false);
  const [serverSettingsModal, setServerSettingsModal] = createSignal(false);
  const [movieStreamModal, setMovieStreamModal] = createSignal(false);
  const [currentVideo, setCurrentVideo] = createSignal(null);

  const openSearch = (query = '') => {
    setSearchInitialQuery(query);
    setSearchModal(true);
  };

  const openPreview = (item, source = null) => {
    setDetailsId(`PREVIEW_${JSON.stringify(item)}`);
    setPreviewSource(source);
  };

  const closeDetails = () => {
    setDetailsId(null);
    setPreviewSource(null);
  };

  return {
    searchModal, setSearchModal, searchInitialQuery, setSearchInitialQuery, openSearch,
    detailsId, setDetailsId, previewSource, setPreviewSource, openPreview, closeDetails,
    settingsModal, setSettingsModal, serverSettingsModal, setServerSettingsModal,
    movieStreamModal, setMovieStreamModal, currentVideo, setCurrentVideo
  };
}

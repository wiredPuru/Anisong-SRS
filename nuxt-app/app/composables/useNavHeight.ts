/* Vertical space the navigation takes at the top of the viewport. Since
   feature 50a moved navigation into a full-height left rail, nothing sits
   above the content any more, so this is 0 and nothing writes to it.
   StudyMediaPlayer still reads it as --nav-height for its expanded-player
   math; removing it there is 50b's job, when that screen is rebuilt. */
export function useNavHeight() {
  const height = useState<number>("navHeight", () => 0);
  return { height };
}

export function useNavHeight() {
  const height = useState<number>("navHeight", () => 64);
  return { height };
}

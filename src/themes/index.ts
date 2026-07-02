export type ThemeId = "default" | "matcha" | "mono" | "ocean" | "manga" | "antarctic";

export type AppTheme = {
  id: ThemeId;
  name: string;
  className: string;
  backdropClassName: string;
};

import { defaultTheme } from "./default";
import { matchaTheme } from "./matcha";
import { monoTheme } from "./mono";
import { oceanTheme } from "./ocean";
import { mangaTheme } from "./manga";
import { antarcticTheme } from "./antarctic";

export const themes: AppTheme[] = [
  defaultTheme,
  matchaTheme,
  monoTheme,
  oceanTheme,
  mangaTheme,
  antarcticTheme,
];

export function getTheme(themeId: ThemeId) {
  return themes.find((theme) => theme.id === themeId) ?? themes[0];
}

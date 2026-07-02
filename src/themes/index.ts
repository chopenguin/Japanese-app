export type ThemeId = "default" | "matcha" | "mono";

export type AppTheme = {
  id: ThemeId;
  name: string;
  className: string;
};

import { defaultTheme } from "./default";
import { matchaTheme } from "./matcha";
import { monoTheme } from "./mono";

export const themes: AppTheme[] = [defaultTheme, matchaTheme, monoTheme];

export function getTheme(themeId: ThemeId) {
  return themes.find((theme) => theme.id === themeId) ?? themes[0];
}

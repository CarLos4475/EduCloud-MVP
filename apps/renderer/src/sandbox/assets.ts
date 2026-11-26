/* Recursos que el anfitrión entrega al sandbox: estilos del kit, script del kit y tipografías
   incrustadas (el sandbox no tiene red, así que las fuentes viajan como datos). Se cargan solo
   cuando se abre un recurso interactivo. */
import kitCss from "./kit.css?raw";
import kitJs from "./kit.js?raw";
import katexCss from "katex/dist/katex.min.css?raw";
import alfa from "@fontsource/alfa-slab-one/files/alfa-slab-one-latin-400-normal.woff2?inline";
import archivo4 from "@fontsource/archivo-narrow/files/archivo-narrow-latin-400-normal.woff2?inline";
import archivo7 from "@fontsource/archivo-narrow/files/archivo-narrow-latin-700-normal.woff2?inline";
import mono from "@fontsource/dm-mono/files/dm-mono-latin-400-normal.woff2?inline";
import kAms from "katex/dist/fonts/KaTeX_AMS-Regular.woff2?inline";
import kCal from "katex/dist/fonts/KaTeX_Caligraphic-Regular.woff2?inline";
import kMain from "katex/dist/fonts/KaTeX_Main-Regular.woff2?inline";
import kMainB from "katex/dist/fonts/KaTeX_Main-Bold.woff2?inline";
import kMainI from "katex/dist/fonts/KaTeX_Main-Italic.woff2?inline";
import kMainBI from "katex/dist/fonts/KaTeX_Main-BoldItalic.woff2?inline";
import kMath from "katex/dist/fonts/KaTeX_Math-Italic.woff2?inline";
import kS1 from "katex/dist/fonts/KaTeX_Size1-Regular.woff2?inline";
import kS2 from "katex/dist/fonts/KaTeX_Size2-Regular.woff2?inline";
import kS3 from "katex/dist/fonts/KaTeX_Size3-Regular.woff2?inline";
import kS4 from "katex/dist/fonts/KaTeX_Size4-Regular.woff2?inline";

const katexFonts: Record<string, string> = {
  "KaTeX_AMS-Regular": kAms,
  "KaTeX_Caligraphic-Regular": kCal,
  "KaTeX_Main-Regular": kMain,
  "KaTeX_Main-Bold": kMainB,
  "KaTeX_Main-Italic": kMainI,
  "KaTeX_Main-BoldItalic": kMainBI,
  "KaTeX_Math-Italic": kMath,
  "KaTeX_Size1-Regular": kS1,
  "KaTeX_Size2-Regular": kS2,
  "KaTeX_Size3-Regular": kS3,
  "KaTeX_Size4-Regular": kS4,
};

function face(family: string, weight: number, uri: string) {
  return `@font-face{font-family:"${family}";font-weight:${weight};font-style:normal;font-display:block;src:url(${uri}) format("woff2")}`;
}

// Solo se conservan los tipos de letra de KaTeX que se incrustaron; el resto se descarta.
const embeddedKatex = katexCss.replace(/@font-face\{[^}]*\}/g, (block) => {
  const name = /fonts\/(KaTeX_[\w-]+)\.woff2/.exec(block)?.[1];
  const uri = name ? katexFonts[name] : undefined;
  return uri
    ? block.replace(/src:[^;}]*/, `src:url(${uri}) format("woff2")`)
    : "";
});

export const sandboxCss = [
  face("Alfa Slab One", 400, alfa),
  face("Archivo Narrow", 400, archivo4),
  face("Archivo Narrow", 700, archivo7),
  face("DM Mono", 400, mono),
  embeddedKatex,
  kitCss,
].join("\n");
export const sandboxKit = kitJs;

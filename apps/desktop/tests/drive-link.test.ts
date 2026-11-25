/** Testes da leitura do link de pasta do Google Drive. */
import { describe, expect, it } from "vitest";
import { extrairIdPastaDrive } from "../src/shared/drive-link";

const ID = "1fJXdtLPrPwwWPh_ETgat-2xBGWQ1I8yW";

describe("extrairIdPastaDrive", () => {
  it("lê o link de compartilhamento", () => {
    expect(
      extrairIdPastaDrive(
        `https://drive.google.com/drive/folders/${ID}?usp=sharing`,
      ),
    ).toBe(ID);
  });
  it("lê o link com /u/0/ e com ?id=", () => {
    expect(
      extrairIdPastaDrive(`https://drive.google.com/drive/u/0/folders/${ID}`),
    ).toBe(ID);
    expect(extrairIdPastaDrive(`https://drive.google.com/open?id=${ID}`)).toBe(
      ID,
    );
  });
  it("aceita o ID puro", () => {
    expect(extrairIdPastaDrive(` ${ID} `)).toBe(ID);
  });
  it("recusa outros sites e textos", () => {
    expect(
      extrairIdPastaDrive("https://evil.example/drive/folders/" + ID),
    ).toBeNull();
    expect(
      extrairIdPastaDrive("http://drive.google.com/drive/folders/" + ID),
    ).toBeNull();
    expect(extrairIdPastaDrive("")).toBeNull();
    expect(extrairIdPastaDrive("não é link")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { homePathFor, isPublicPath, safeRedirect } from "@/lib/auth/routes";
import { GENERIC_ERROR, toFrenchMessage } from "@/lib/errors";
import { navFor } from "@/lib/auth/navigation";

describe("safeRedirect", () => {
  it("garde les chemins internes", () =>
    expect(safeRedirect("/stocks?pole=restaurant")).toBe("/stocks?pole=restaurant"));
  it.each(["https://evil.test", "//evil.test", "/\\evil.test", "", null, undefined])(
    "refuse %s",
    (v) => expect(safeRedirect(v)).toBe("/"),
  );
});

describe("isPublicPath", () => {
  it("laisse passer les pages d'authentification", () => {
    expect(isPublicPath("/connexion")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
  });
  it("protège le reste", () => {
    expect(isPublicPath("/stocks")).toBe(false);
    expect(isPublicPath("/connexion-admin")).toBe(false);
  });
});

describe("homePathFor et navigation par rôle", () => {
  it("dirige chaque rôle vers sa page d'accueil", () => {
    expect(homePathFor("gerant")).toBe("/tableau-de-bord");
    expect(homePathFor("responsable")).toBe("/stocks");
    expect(homePathFor("salarie")).toBe("/stocks");
  });
  it("ne montre au salarié que les stocks", () => {
    expect(navFor("salarie").map((i) => i.href)).toEqual(["/stocks"]);
  });
  it("cache appels et paramètres au responsable", () => {
    const hrefs = navFor("responsable").map((i) => i.href);
    expect(hrefs).not.toContain("/appels");
    expect(hrefs).not.toContain("/parametres");
  });
});

describe("toFrenchMessage", () => {
  it("traduit les erreurs d'authentification", () => {
    expect(toFrenchMessage({ code: "invalid_credentials" })).toBe(
      "E-mail ou mot de passe incorrect.",
    );
  });
  it("traduit les codes Postgres", () => {
    expect(toFrenchMessage({ code: "23505" })).toBe("Cet élément existe déjà.");
  });
  it("conserve les messages français levés par la base", () => {
    expect(
      toFrenchMessage({
        code: "P0001",
        message: "Impossible : ce compte est le dernier gérant actif.",
      }),
    ).toBe("Impossible : ce compte est le dernier gérant actif.");
  });
  it("masque les messages techniques", () => {
    expect(toFrenchMessage({ message: "connection refused" })).toBe(GENERIC_ERROR);
    expect(toFrenchMessage(null)).toBe(GENERIC_ERROR);
  });
});

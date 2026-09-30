export type Replique = { locuteur: "client" | "ia" | null; texte: string };

/**
 * Découpe une transcription « Client : … / IA : … » en répliques. Une ligne sans locuteur
 * prolonge la réplique précédente ; un texte sans aucun locuteur reste un seul bloc.
 */
export function decouperTranscription(transcription: string): Replique[] {
  const repliques: Replique[] = [];
  for (const ligne of transcription.split(/\r?\n/)) {
    const m = ligne.match(/^\s*(client|appelant|ia|assistant)\s*:\s*(.*)$/i);
    if (m) {
      repliques.push({
        locuteur: /^(client|appelant)$/i.test(m[1]) ? "client" : "ia",
        texte: m[2].trim(),
      });
    } else if (ligne.trim()) {
      const derniere = repliques[repliques.length - 1];
      if (derniere) derniere.texte += `\n${ligne.trim()}`;
      else repliques.push({ locuteur: null, texte: ligne.trim() });
    }
  }
  return repliques;
}

// Tri automatique : dossiers proposés + règles par mots-clés (nom et description de la chaîne).
// Les règles sont testées dans l'ordre : la première qui correspond gagne.
// Tu peux modifier ce fichier pour adapter le tri à tes goûts.
window.__ytfPreset = {
  folders: [
    { emoji: '🧱', name: 'Minecraft', color: '#2ba640' },
    { emoji: '📺', name: 'Rediffs & streams', color: '#ff4e45' },
    { emoji: '📖', name: 'Culture jeu vidéo', color: '#a142f4' },
    { emoji: '🔧', name: 'Réparation & électronique', color: '#ff8a3d' },
    { emoji: '💻', name: 'Code & dev', color: '#3ea6ff' },
    { emoji: '🖥️', name: 'Tech & hardware', color: '#00bfa5' },
    { emoji: '🛠️', name: 'DIY & makers', color: '#f9a825' },
    { emoji: '🏚️', name: 'Maison & rénovation', color: '#ff7ab6' },
    { emoji: '🚗', name: 'Auto & moto', color: '#ff4e45' },
    { emoji: '🧪', name: 'Science & culture G', color: '#2ba640' },
    { emoji: '🕵️', name: 'Histoire & enquêtes', color: '#a142f4' },
    { emoji: '🎵', name: 'Musique', color: '#ff7ab6' },
    { emoji: '🍳', name: 'Cuisine', color: '#f9a825' },
    { emoji: '⚽', name: 'Sport', color: '#2ba640' },
    { emoji: '🎮', name: 'Jeux vidéo', color: '#3ea6ff' },
    { emoji: '😂', name: 'Divertissement', color: '#f9a825' }
  ],
  byKey: {},
  byName: {}
};

window.__ytfRules = [
  ['Minecraft', /minecraft|redstone|vive le cube|j'aime les blocs|[a-z]mc\b/i],
  ['Rediffs & streams', /rediff|best ?of/i],
  ['Culture jeu vidéo', /\blore\b|culture du jeu|histoires? (sur|des|de) (les |la |l')?(jeux|anim)|gameplays? en histoires|analyse.{0,20}jeux?/i],
  ['Réparation & électronique', /r[ée]par|repair|fixing|[ée]lectroni|solder|modding|r[ée]tro.?gaming|hardware hacking|semi.?conduct/i],
  ['Code & dev', /\bcod(e|er|eur|ing)\b|programmation|programmeur|programmes que je|d[ée]velopp|cr[ée]er des jeux|cr[ée]ateur de jeux|jouer? à cr[ée]er|cr[ée]er? des jeux|cyber.?s[ée]curit|osint/i],
  ['Science & culture G', /science|chimi|chemistry|physique|vulgaris|ing[ée]nieur|engineer|nasa|culture ?g|cultiv|expliqu|questions que personne|casse.?t[êe]te/i],
  ['Tech & hardware', /hardware|high.?tech|smartphone|pc gamer|carte graphique|informatique|nouvelles technologies|\btech\b/i],
  ['DIY & makers', /\bdiy\b|fabri|impression 3d|3d print|maker|artisan|bricol|soudure|menuis|horlog|je fabrique|making|design|rangement/i],
  ['Maison & rénovation', /r[ée]nov|chantier|ch[âa]teau|jardin|construction|maison/i],
  ['Auto & moto', /voiture|automobile|\bmotos?\b|m[ée]cani|bagnole|garage|turbine|\bcars?\b/i],
  ['Histoire & enquêtes', /histoire|history|true.?crime|enqu[êe]te|documentaire|\bdocu\b|mafi|gangster|histoires? (vraies?|incroyables)|raconte des histoires|abandonn/i],
  ['Musique', /musique|music|beatmaker|chanson|\brap\b|lofi|concert/i],
  ['Cuisine', /cuisine|recette|cooking|p[âa]tisserie|food/i],
  ['Sport', /\bsports?\b|football|\bfoot\b|basket|muscu|fitness|parkour|escalade|grimpe/i],
  ['Jeux vidéo', /\bjeux?\b|gaming|gameplay|gamer|\bgames?\b|jeu vid|roguelike|ind[ée]pendant|horreur|\bfps\b|streamer|twitch/i],
  ['Divertissement', /humour|dr[ôo]le|marrant|vlog|d[ée]fi|challenge|\bfun\b|exp[ée]rience|voyage|blague|youtubeur|youtuber|vid[ée]os/i]
];

// the page the demo user is "reading": rendered in the browser window and sent to Claude as context
export const ARTICLE = {
  kicker: "Esports Daily · Oct 23",
  title: "T1 reach the final after a five-game thriller",
  paras: [
    "T1 survived a back-and-forth semifinal, turning a slow opening into a decisive lead through snowballing in the mid game. After trading objectives for twenty minutes, they secured Baron and ended the game within three fights.",
    "The coach said the team prepared the draft for weeks. The final is next Saturday.",
  ],
};

export const ARTICLE_TEXT = ARTICLE.paras.join("\n\n");

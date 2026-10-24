// the page the demo user is "reading": rendered in the browser window and sent to Claude as context.
// Excerpts of an open-access paper (CC BY 4.0), kept in English; Alter explains it in Korean.
export const ARTICLE = {
  kicker: "Nature · 2024 · Abramson et al.",
  title: "Accurate structure prediction of biomolecular interactions with AlphaFold 3",
  paras: [
    "Here we describe our AlphaFold 3 model with a substantially updated diffusion-based architecture that is capable of predicting the joint structure of complexes including proteins, nucleic acids, small molecules, ions and modified residues. The new AlphaFold model demonstrates substantially improved accuracy over many previous specialized tools: far greater accuracy for protein–ligand interactions compared with state-of-the-art docking tools, much higher accuracy for protein–nucleic acid interactions compared with nucleic-acid-specific predictors and substantially higher antibody–antigen prediction accuracy compared with AlphaFold-Multimer v.2.3.",
    "This is achieved by a substantial evolution of the AF2 architecture and training procedure both to accommodate more general chemical structures and to improve the data efficiency of learning. The system reduces the amount of multiple-sequence alignment (MSA) processing by replacing the AF2 evoformer with the simpler pairformer module. Furthermore it directly predicts the raw atom coordinates with a diffusion module, replacing the AF2 structure module that operated on amino-acid-specific frames and side-chain torsion angles.",
    "The multiscale nature of the diffusion process (low noise levels induce the network to improve local structure) also enable us to eliminate stereochemical losses and most special handling of bonding patterns in the network, easily accommodating arbitrary chemical components.",
  ],
  source: "Abramson, J. et al., Nature 630, 493–500 (2024), CC BY 4.0. 일부 발췌. doi:10.1038/s41586-024-07487-w",
};

export const ARTICLE_TEXT = ARTICLE.paras.join("\n\n");

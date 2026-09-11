import type { HelpCatalogue, HelpChrome } from "./types";

/**
 * Le guide des processus en français. Traduit de `en.ts` et calé sur les libellés que
 * l'application affiche réellement en français (`src/i18n/locales/fr.json`) : chaque bouton
 * cité porte ici le texte que l'utilisateur voit à l'écran. Mêmes sujets, même ordre et même
 * structure que le catalogue anglais — un test de parité le vérifie.
 */
export const helpCatalogueFr: HelpCatalogue = [
  {
    id: "getting-started",
    title: "Se connecter et rejoindre une société",
    purpose:
      "Folio vous connecte avec votre numéro de téléphone et un code reçu par SMS — il n'y a pas de mot de passe. Avant de voir quoi que ce soit, votre compte doit appartenir à une société.",
    steps: [
      "Saisissez votre numéro de téléphone et touchez « Envoyer le code ». Numéros français uniquement, sans le 0 initial.",
      "Entrez les six chiffres reçus par SMS. La connexion se fait automatiquement dès le sixième chiffre.",
      "Pas encore de compte ? Touchez « Créer un compte », confirmez votre numéro de la même manière, saisissez votre nom et touchez « Créer mon profil ».",
      "Si vous n'appartenez à aucune société, choisissez « Créer une entreprise » — renseignez la raison sociale et l'adresse — ou « Rejoindre avec un code » et saisissez le code à 8 caractères fourni par votre administrateur.",
      "Si vous avez rejoint comme membre sans avoir encore de chantier, vous restez sur « Presque prêt » jusqu'à ce qu'un administrateur vous affecte à un chantier. Tirez vers le bas pour actualiser.",
      "Plus tard, Paramètres → « Rejoindre une autre société » rouvre le même écran de code.",
    ],
    whoCanDoIt:
      "Tout le monde. « Créer un compte » n'apparaît que si le serveur autorise l'inscription libre.",
    gotchas: [
      "Seuls les numéros français sont acceptés à la connexion.",
      "Chaque écran de démarrage garde une porte de sortie « Se déconnecter » si vous vous êtes trompé de compte.",
    ],
  },
  {
    id: "shell",
    title: "Se repérer dans l'application",
    purpose:
      "Un seul chantier est sélectionné à la fois, et toute l'application parle de ce chantier. La barre d'onglets porte quatre écrans de chantier ; tout le reste vit derrière Menu.",
    steps: [
      "Touchez le nom du chantier en haut, puis choisissez un chantier dans la liste — chaque ligne affiche son budget restant.",
      "Dans ce même panneau, « + Nouveau chantier » crée un chantier : nom, adresse, budget et source du budget.",
      "En tant que responsable, les quatre onglets sont Aperçu, Dépenses, Main-d'œuvre et Planning. En tant qu'ouvrier, ce sont Présence, Salaire, Profil et Planning.",
      "Les responsables disposent d'un « Menu » pour tout le reste : devis et factures, bibliothèque de produits, membres de l'entreprise, et les sections du chantier — documents, photos, notes, salaires, chiffrage, analyses, membres et réglages. Les ouvriers ne l'ont pas : les sujets ci-dessous qui partent du Menu sont à lire, pas à suivre.",
      "Touchez vos initiales pour les Paramètres, le choix de la langue (English, Français, Tiếng Việt) et « Se déconnecter ».",
      "Touchez la cloche pour ce qui vous attend, et le point d'interrogation pour ce guide.",
    ],
    whoCanDoIt:
      "Tout le monde peut changer de chantier et ouvrir son compte. Créer un chantier demande le droit de créer un chantier ou l'administration de la société. Devis et factures, membres de l'entreprise et documents n'apparaissent que pour les personnes qui y ont droit.",
    gotchas: [
      "L'onglet Dépenses dessine son propre en-tête avec le sélecteur de mois : la cloche, votre avatar et ce guide n'y figurent pas — ouvrez le guide depuis un autre onglet.",
      "Un nouveau chantier est créé dans votre société principale et vous en devenez le responsable.",
    ],
  },
  {
    id: "overview",
    title: "L'aperçu du chantier",
    purpose:
      "Le résumé de l'argent et de l'activité du chantier sélectionné : ce qu'il reste à dépenser, ce qui est dû, les dépenses du mois, la semaine à venir et qui est sur le chantier aujourd'hui.",
    steps: [
      "Lisez le chiffre principal en haut — ce qui reste, face à « Dépensé … sur … de crédit ».",
      "Utilisez les actions rapides : « Facture » ouvre une nouvelle dépense, « Débloquer » ouvre le même formulaire préréglé sur un déblocage bancaire, « Payer la MO » saute à l'onglet Main-d'œuvre sur son segment Paiements.",
      "Surveillez les tuiles d'échéance : « Impayé » mène à « Payer », « À rembourser » ouvre les dépenses que la société vous doit encore.",
      "Touchez la carte des dépenses du mois pour ouvrir le journal complet de ce mois.",
      "Touchez « Agenda » sur la carte « Cette semaine » pour ouvrir le Planning.",
      "« Aujourd'hui sur site » indique combien d'ouvriers sont attendus et la météo à l'adresse du chantier.",
    ],
    whoCanDoIt:
      "Tout membre du chantier. Sans le droit de voir le budget, le montant du crédit bancaire est omis plutôt qu'affiché à zéro.",
    gotchas: [
      "Les ouvriers voient ici leur propre écran de présence à la place de l'aperçu.",
    ],
  },
  {
    id: "planning",
    title: "Tâches et planning",
    purpose:
      "Un tableau de tâches pour le chantier, affiché une colonne à la fois. Responsables et ouvriers voient le même tableau.",
    steps: [
      "Choisissez une colonne dans le sélecteur : Backlog, À faire, En cours, Bloqué ou Terminé.",
      "Touchez « Tâche » pour en ajouter une : le titre est obligatoire, puis description, colonne, priorité, échéance et étiquettes. Touchez « Enregistrer ».",
      "Touchez une carte pour la rouvrir et la modifier.",
      "Cochez la case d'une carte pour l'envoyer directement dans Terminé, ou la ramener dans À faire.",
      "En modification, « Monter » et « Descendre » déplacent la tâche dans sa colonne.",
      "En modification, « Supprimer » retire la tâche après confirmation.",
    ],
    whoCanDoIt:
      "Tout membre du chantier peut lire, créer et modifier des tâches. La suppression demande le droit de modifier le chantier : les ouvriers ne peuvent donc pas supprimer.",
  },
  {
    id: "attendance",
    title: "Saisir les présences",
    purpose:
      "Enregistrez quels ouvriers étaient sur le chantier chaque jour du mois et quel poste ils ont fait. C'est ce qui alimente la paie.",
    steps: [
      "Choisissez le mois avec le sélecteur en haut de l'onglet Main-d'œuvre, puis le segment « Pointage ».",
      "Basculez entre « Calendrier » et « Liste » ; la ligne au-dessus affiche les jours travaillés, le coût et ce qui reste impayé.",
      "Touchez un jour, puis « Pointer ce jour ».",
      "Dans le panneau, touchez chaque ouvrier présent, touchez sa pastille pour faire défiler « Journée », « Demi-journée » ou « Heures sup », et utilisez +/− pour le supplément d'heures. Terminez avec le bouton « Saisir … ».",
      "Touchez une saisie existante pour changer son poste, son supplément d'heures, son montant forcé ou sa note — ou pour la supprimer.",
      "Touchez « Activités & notes › » pour consigner ce qui a été fait ce jour-là et une description de la journée.",
      "Utilisez le bouton de téléchargement pour exporter une plage de mois, pour un ouvrier ou pour tous.",
    ],
    whoCanDoIt:
      "Toute personne qui gère les présences sur le chantier. Sans ce droit, l'onglet Main-d'œuvre devient votre propre profil.",
    gotchas: [
      "Pointer un ouvrier déjà pointé sur un autre chantier le même jour demande une confirmation avec « Saisir quand même ».",
    ],
  },
  {
    id: "attendance-validation",
    title: "Valider les journées déclarées par les ouvriers",
    purpose:
      "Les ouvriers déclarent eux-mêmes leurs journées ; vous les validez ou les refusez. Cela se passe dans la cloche, pas dans l'onglet Main-d'œuvre.",
    steps: [
      "Touchez la cloche dans la barre du haut.",
      "Le premier bloc est « Pointages à valider », une ligne par ouvrier et par jour, avec le poste déclaré.",
      "Pour une nouvelle déclaration, touchez « Valider » pour l'accepter, ou « Refuser » — refuser supprime la saisie, une confirmation est donc demandée.",
      "Quand un ouvrier demande de modifier un jour que vous avez déjà validé, la ligne affiche l'ancienne et la nouvelle valeur ; les boutons deviennent « Appliquer » et « Refuser ».",
      "Refuser une modification laisse la journée telle qu'elle a été validée.",
    ],
    whoCanDoIt:
      "Les personnes que le chantier désigne comme validateurs — en pratique celles qui gèrent les présences. Le bloc disparaît simplement quand rien n'attend.",
    gotchas: [
      "La cloche se rafraîchit environ toutes les minutes : une journée déclarée pendant que l'application est ouverte apparaît d'elle-même.",
    ],
  },
  {
    id: "workers",
    title: "Ouvriers et taux journaliers",
    purpose:
      "L'équipe de ce chantier : qui y travaille, son rôle, son taux journalier, et comment ce taux a évolué.",
    steps: [
      "Ouvrez l'onglet Main-d'œuvre, choisissez le segment « Ouvriers », puis touchez « Ajouter un ouvrier ».",
      "Choisissez « Ouvrier de l'entreprise » pour reprendre quelqu'un dans l'annuaire de l'entreprise, ou « Nouvelle personne » pour le saisir à la main.",
      "Renseignez le nom, le taux journalier, un téléphone, un rôle, et reliez un compte appli s'il en a un. Touchez « Enregistrer ».",
      "Touchez un ouvrier pour accéder à « Modifier », « Taux » et « Supprimer ».",
      "« Taux » affiche le taux actuel et son historique. Indiquez la date de prise d'effet et le nouveau taux, lisez la ligne qui vous dit combien de jours déjà pointés seront recalculés, puis touchez « Ajouter un changement ».",
      "Retirer un ouvrier conserve son historique de présence sur le chantier.",
    ],
    whoCanDoIt:
      "Toute personne qui gère les présences sur le chantier. Piocher dans l'annuaire de l'entreprise demande en plus d'administrer ou de gérer cette entreprise.",
    gotchas: [
      "Un changement de taux est daté et recalcule les jours déjà pointés à partir de cette date — le panneau vous prévient avant que vous validiez.",
    ],
  },
  {
    id: "labor-payments",
    title: "Payer les ouvriers",
    purpose:
      "Voir ce qui est dû à chaque ouvrier pour le mois et enregistrer ce que vous lui avez réellement versé.",
    steps: [
      "Ouvrez l'onglet Main-d'œuvre et choisissez le segment « Paiements ».",
      "Lisez la ligne de chaque ouvrier : soldé ou à payer, et combien est payé sur ce qui est dû.",
      "Touchez « Enregistrer un paiement », ou touchez la ligne de l'ouvrier.",
      "Choisissez l'ouvrier, ajustez le montant — il arrive prérempli avec le solde restant — et choisissez un moyen de paiement.",
      "Confirmez avec « Enregistrer un paiement ».",
      "Sous la liste, « Factures main-d'œuvre sans ouvrier » regroupe les dépenses de main-d'œuvre sans personne rattachée ; touchez-en une pour l'ouvrir et l'attribuer.",
    ],
    whoCanDoIt:
      "Gérer les présences donne accès à l'écran ; enregistrer un paiement demande en plus le droit sur les factures, sans lequel le bouton reste masqué.",
    gotchas: [
      "Enregistrer un paiement crée une dépense de main-d'œuvre sur le chantier : elle apparaît donc aussi dans le journal des dépenses.",
    ],
  },
  {
    id: "salaries",
    title: "Les salaires, mois par mois",
    purpose:
      "Par ouvrier et par mois : ce qu'il a gagné face à ce qui a été payé, et ce qui reste à payer.",
    steps: [
      "Ouvrez Menu → Salaires et choisissez un ouvrier.",
      "Lisez les totaux : total gagné, total payé et reste à payer.",
      "Chaque carte de mois indique s'il est payé, partiellement payé, non payé ou en trop-perçu, avec les jours travaillés et les montants.",
      "Touchez « Marquer payé » sur un mois, indiquez le montant et le moyen de paiement, puis confirmez.",
      "« Marquer non payé » supprime les paiements enregistrés pour ce mois, après confirmation.",
    ],
    whoCanDoIt:
      "Toute personne qui peut ouvrir la section peut la lire. Changer le statut de paiement demande le droit sur les factures ; sans lui, l'écran le dit clairement.",
    webOnlyNote:
      "L'application web n'a pas de page salaires — cette vue n'existe que sur le téléphone.",
  },
  {
    id: "expenses",
    title: "Le journal des dépenses",
    purpose:
      "Chaque euro sorti du chantier, mois par mois : factures fournisseurs, déblocages bancaires, paiements de main-d'œuvre et avoirs fournisseurs.",
    steps: [
      "Passez d'un mois à l'autre avec les flèches en haut de l'onglet Dépenses.",
      "Lisez le total du mois, le nombre d'écritures, la comparaison avec le mois précédent, et les caisses entreprise et personnelle.",
      "Filtrez par type : tout, fonds débloqués, main-d'œuvre, matériaux & services, ou autres.",
      "Si des dépenses attendent un remboursement, un bandeau les compte et « Voir » les ouvre.",
      "Touchez n'importe quelle ligne pour ouvrir la dépense en entier.",
      "Utilisez « Exporter Excel / PDF » pour exporter une plage de mois.",
      "Touchez le bouton rond + en bas à droite pour enregistrer une nouvelle dépense.",
    ],
    whoCanDoIt:
      "Tout membre du chantier. Le droit de voir le budget commande les cartes de caisse et le filtre des fonds débloqués.",
    gotchas: [
      "Le sélecteur de mois s'arrête au mois le plus récent qui contient des données.",
      "Les ouvriers voient ici leur propre salaire à la place du journal.",
    ],
  },
  {
    id: "expense-create",
    title: "Enregistrer une dépense",
    purpose:
      "Saisir une dépense : une facture fournisseur, un paiement de main-d'œuvre, un déblocage sur le crédit bancaire, ou un avoir d'un fournisseur.",
    steps: [
      "Choisissez le type : fonds débloqués, main-d'œuvre, matériaux & services, autres, ou retour / avoir.",
      "Indiquez la date d'émission — elle est obligatoire.",
      "Pour la main-d'œuvre, choisissez l'ouvrier et le mois de prestation.",
      "Renseignez le destinataire, éventuellement son adresse, et choisissez un moyen de paiement.",
      "Pour un retour, liez la facture matériaux & services remboursée, indiquez s'il a été réglé en espèces ou par avoir, et, s'il s'agit d'un avoir, à quelle facture il a été appliqué.",
      "Ajoutez au moins une ligne avec une description, une quantité, un prix unitaire et un taux de TVA.",
      "Vérifiez les totaux, ajoutez des notes ou une couleur de surlignage, puis touchez « Créer la facture ».",
    ],
    whoCanDoIt:
      "Tout membre du chantier peut ouvrir le formulaire ; c'est le serveur qui décide si la dépense est acceptée. « Fonds débloqués » n'apparaît qu'avec le droit de voir le budget.",
  },
  {
    id: "expense-detail",
    title: "Pièces jointes et remboursements d'une dépense",
    purpose:
      "Tout sur une dépense : le montant, qui a été payé, les lignes, les fichiers joints, et si la société vous doit encore l'argent.",
    steps: [
      "Ouvrez une dépense depuis le journal. Le haut affiche le total, le destinataire, la date, le moyen de paiement et la caisse d'où elle provient.",
      "Les boutons ronds sont « PDF », « Joindre », « Modifier » et « Supprimer ».",
      "Si vous avez payé vous-même une dépense matériaux & services, le bandeau « Avancé pour la société ? » vous permet de toucher « Transférer » pour lancer le suivi.",
      "Une fois la dépense suivie et la société vous ayant remboursé, touchez « Remboursé ».",
      "Sous « Pièces jointes », ajoutez une photo, piochez dans votre photothèque, ou choisissez un fichier. Chaque fichier peut être ouvert, renommé ou supprimé.",
      "Les pastilles de couleur définissent le surlignage de cette ligne dans le journal.",
    ],
    whoCanDoIt:
      "Tout membre du chantier peut la consulter. Chaque modification — joindre, modifier, supprimer, surligner, transférer, marquer remboursé — demande le droit sur les factures ; sans lui, il ne reste que « PDF ».",
    webOnlyNote:
      "L'application web imprime une facture par une page d'impression dédiée ; le téléphone fabrique le PDF sur place et le passe au partage habituel.",
  },
  {
    id: "billing",
    title: "Devis et factures pour vos clients",
    purpose:
      "Les documents que votre société émet pour ses propres clients — devis et factures — avec des modèles réutilisables et un suivi des dépenses en attente de remboursement.",
    steps: [
      "Ouvrez Menu → « Devis & factures » et basculez entre « Devis » et « Factures ». Cherchez par numéro ou destinataire et filtrez par statut.",
      "Touchez « Nouveau » et choisissez « Vierge », « Depuis un existant » (tout est copié sauf les dates) ou « Depuis un modèle ».",
      "Renseignez la société émettrice, le chantier, le bloc destinataire, les dates, les lignes et les totaux, puis touchez « Créer ».",
      "Sur un document, faites avancer son statut — envoyé, accepté, payée, annulée — et exportez-le en PDF ou en XLSX.",
      "« Dupliquer » copie un document ; un devis accepté se transforme en facture avec « Convertir en facture ».",
      "« Modèles » contient vos modèles de devis et de facture ; « Utiliser » crée un document à partir de l'un d'eux.",
      "« Dépenses remboursables » suit les dépenses de chantier en attente de remboursement : ajoutez-les, fixez leur statut, et dites si la société, la banque ou les deux ont remboursé.",
    ],
    whoCanDoIt:
      "Les administrateurs de société uniquement. Les autres ne voient même pas la ligne dans le Menu.",
    webOnlyNote:
      "L'application web sépare les devis et les factures en deux sections ; le téléphone garde les deux derrière une seule liste.",
  },
  {
    id: "company-members",
    title: "Membres de l'entreprise et permissions",
    purpose:
      "L'annuaire de l'entreprise : qui en fait partie, quel rôle chacun occupe, quelles permissions lui ont été accordées ou refusées en plus, et par où entrent les nouveaux.",
    steps: [
      "Ouvrez Menu → « Membres de l'entreprise ». Si vous administrez plusieurs entreprises, choisissez-en une en haut.",
      "Le code société est tout en haut — créez-le, renouvelez-le, partagez-le ou révoquez-le depuis là.",
      "Touchez « Ajouter par téléphone » pour ajouter quelqu'un par son numéro, avec un nom facultatif et un rôle membre ou responsable.",
      "« Importer d'une autre entreprise » recopie des personnes depuis une entreprise que vous administrez aussi.",
      "Dans la liste des membres, changez un rôle directement sur la ligne, ou ouvrez « Permissions personnalisées » pour autoriser ou refuser une permission précise, sur toute l'entreprise ou sur un seul chantier.",
      "« Profils en attente » liste les personnes que vous avez ajoutées par téléphone et qui ne se sont pas encore connectées.",
    ],
    whoCanDoIt:
      "Les administrateurs de société. Les membres qui sont déjà administrateurs n'ont pas de panneau de permissions personnalisées.",
    webOnlyNote:
      "L'application web propose le même annuaire dans Paramètres → Entreprise.",
    gotchas: [
      "Deux portes d'entrée coexistent : le code société réutilisable que chacun peut saisir, et un jeton d'invitation à usage unique qui expire au bout de sept jours.",
    ],
  },
  {
    id: "project-members",
    title: "Qui travaille sur ce chantier",
    purpose:
      "Affectez à ce chantier des personnes déjà présentes dans l'entreprise, et donnez-leur un rôle dessus.",
    steps: [
      "Ouvrez Menu → Membres, puis touchez « Affecter un membre ».",
      "Choisissez la personne parmi les membres de l'entreprise, choisissez son rôle, puis touchez « Affecter ».",
      "La liste montre toutes les personnes affectées, leur rôle et la date de leur arrivée.",
      "Touchez « Retirer » sur une ligne pour sortir quelqu'un du chantier, après confirmation.",
      "Les anciennes invitations par e-mail apparaissent encore sous « Invitations en attente », avec leur date d'expiration et un bouton « Révoquer ».",
    ],
    whoCanDoIt:
      "Les personnes qui peuvent gérer les membres ou inviter sur le chantier. Vous ne pouvez pas vous retirer vous-même.",
    gotchas: [
      "Les nouvelles personnes sont d'abord ajoutées à l'entreprise, par téléphone, depuis l'écran des membres de l'entreprise — impossible de créer une invitation par e-mail ici.",
      "Les administrateurs de société valent pour tous les chantiers de leur société et n'apparaissent jamais dans la liste.",
    ],
  },
  {
    id: "library",
    title: "La bibliothèque de produits",
    purpose:
      "Le catalogue des produits que l'entreprise achète, avec leurs fournisseurs, leurs prix et leur historique d'achat, réutilisable quand vous chiffrez un chantier.",
    steps: [
      "Ouvrez Menu → « Bibliothèque de produits ». Cherchez par nom, et filtrez par fournisseur ou par catégorie.",
      "Touchez « Ajouter un produit » et renseignez le nom — obligatoire — puis le fournisseur, la référence, la catégorie, la taille, la description, l'URL et une image.",
      "Touchez « Comparer », sélectionnez plusieurs produits, puis « Comparer » à nouveau pour les voir côte à côte.",
      "Touchez un produit pour son détail : fournisseur, référence, nombre d'achats, dernier prix unitaire et historique des achats.",
      "Supprimer un produit affiche combien d'enregistrements d'achat il porte et vous demande de saisir son nom.",
      "« Importer des achats » accepte un export Leroy Merlin, en fichier ou collé, et vous dit ce qui a été créé, mis à jour et ignoré.",
    ],
    whoCanDoIt:
      "Toute personne qui peut ouvrir le Menu atteint la bibliothèque. C'est le serveur qui décide si vos modifications sont acceptées, et il vous prévient quand elles ne le sont pas.",
    gotchas: [
      "Les compteurs de produits et de fournisseurs affichés sur la ligne du Menu viennent de votre première société, qui n'est pas forcément celle du chantier.",
    ],
  },
  {
    id: "chiffrage",
    title: "Chiffrer les matériaux",
    purpose:
      "Chiffrez les matériaux du chantier : des postes, puis des articles par pièce, puis un prix par magasin, avec un panier et un total courant pour chaque magasin.",
    steps: [
      "Ouvrez Menu → Chiffrage et montez la structure avec « Ajouter un poste », « Ajouter un magasin », « Ajouter une pièce » et « Ajouter une unité ».",
      "Dans un poste, touchez « Ajouter un article » et donnez-lui un nom, une quantité, une unité et une pièce — ou utilisez « Choisir dans la bibliothèque » pour reprendre un produit que vous avez déjà.",
      "Sur un article, touchez « Ajouter un prix » et saisissez le prix unitaire HT, le taux de TVA, le magasin, le fournisseur et une URL de produit.",
      "Joignez une photo en la prenant ou en donnant l'URL d'une image.",
      "Lisez les totaux HT et TTC, ainsi que le nombre d'articles encore sans prix.",
      "Le panier d'un magasin indique « couvre tout » quand ce magasin peut fournir tous les articles.",
    ],
    whoCanDoIt:
      "Tout membre du chantier qui peut ouvrir le Menu. C'est le serveur qui décide si vos modifications sont acceptées.",
  },
  {
    id: "documents",
    title: "Les documents du chantier",
    purpose:
      "Le classeur du chantier — plans, autorisations, contrats — avec étiquettes, filtres et tri.",
    steps: [
      "Ouvrez Menu → Documents. Filtrez par type, par auteur ou par étiquette, et triez par date, nom, taille ou auteur.",
      "Touchez « Ajouter un document » et prenez une photo, piochez dans votre photothèque, ou choisissez un fichier.",
      "Touchez « Modifier » sur une ligne pour renommer le fichier ou saisir des étiquettes séparées par des virgules.",
      "Touchez « Supprimer » pour retirer un document, après confirmation.",
    ],
    whoCanDoIt:
      "Les responsables du chantier uniquement, lecture comprise. Sans ces droits, la section n'est même pas listée dans le Menu.",
  },
  {
    id: "photos",
    title: "Les photos du chantier",
    purpose:
      "La galerie photo du chantier, vidéos comprises, chacune avec une légende facultative.",
    steps: [
      "Ouvrez Menu → Photos, puis touchez « Ajouter des photos » pour en prendre une ou piocher dans votre photothèque.",
      "Touchez une photo pour l'ouvrir, écrivez une légende et touchez « Enregistrer ».",
      "« Partager » passe le fichier au téléphone ; les vidéos ne s'ouvrent que comme ça.",
      "« Supprimer » retire une photo après confirmation.",
      "« Charger plus » fait défiler la galerie page par page.",
    ],
    whoCanDoIt:
      "Tout membre du chantier peut regarder. Ajouter, légender et supprimer demandent le droit de modifier le chantier.",
  },
  {
    id: "notes",
    title: "Notes et rappels du chantier",
    purpose:
      "Des notes datées sur le chantier — inspections, livraisons, décisions, appels. Une note avec une échéance devient un rappel dans la cloche.",
    steps: [
      "Ouvrez Menu → Notes. Filtrez par catégorie ou faites une recherche.",
      "Ajoutez une note : le titre est obligatoire, puis les détails et une catégorie — inspection, livraison, paiement, décision, appel ou général.",
      "Touchez une note pour la modifier.",
      "Utilisez « Marquer terminé » ou « Rouvrir » sur une note, ou « Supprimer » pour l'effacer.",
    ],
    whoCanDoIt:
      "Tout membre du chantier peut lire. Chaque modification demande le droit de modifier le chantier.",
    gotchas: [
      "Ignorer un rappel dans la cloche ne fait que le masquer là ; la note, elle, reste.",
    ],
  },
  {
    id: "analyses",
    title: "Les rapports d'analyse",
    purpose:
      "Conservez des rapports d'analyse HTML sur le chantier, cherchables et étiquetés.",
    steps: [
      "Ouvrez Menu → Analyses. Cherchez, ou filtrez par étiquette.",
      "Touchez le bouton d'ajout, choisissez le rapport HTML — obligatoire — puis donnez un titre, un résumé, une URL source et des étiquettes.",
      "Touchez une ligne pour lire le rapport.",
      "« Modifier » rouvre les détails ; « Supprimer » retire l'analyse après confirmation.",
    ],
    whoCanDoIt:
      "Tout membre du chantier peut lire. Chaque modification demande le droit de modifier le chantier.",
  },
  {
    id: "chat",
    title: "La discussion d'équipe",
    purpose:
      "Une conversation en texte et en photos avec votre société et l'équipe du chantier, un canal par société et par chantier.",
    steps: [
      "Touchez le bouton rond de message en bas à droite d'un onglet de chantier.",
      "Choisissez un canal parmi les pastilles du haut ; un point signale ceux qui ont des messages non lus.",
      "Écrivez votre message et envoyez-le.",
      "Joignez une photo avec + pour en choisir une, ou avec le bouton appareil photo pour en prendre une.",
      "Les avatars sous le dernier message montrent qui a lu jusque-là.",
    ],
    whoCanDoIt:
      "Tout le monde. Les canaux que vous voyez suivent vos accès société et les chantiers sur lesquels vous êtes.",
    webOnlyNote:
      "L'application web propose la même discussion d'équipe, derrière un bouton dans le coin de l'écran : une conversation se poursuit d'un support à l'autre.",
    gotchas: [
      "Les messages arrivent par interrogation régulière, toutes les quelques secondes, et non instantanément.",
      "Le bouton se cache pendant qu'un panneau est ouvert, et sur les écrans qui ne font pas partie des quatre onglets.",
    ],
  },
  {
    id: "notifications",
    title: "La cloche",
    purpose:
      "Un seul endroit pour tout ce qui vous attend : les pointages à valider, les nouveaux membres de l'entreprise à placer, et les notes dont l'échéance est arrivée.",
    steps: [
      "Touchez la cloche dans la barre du haut. Un point apparaît dès que quelque chose attend.",
      "Le premier bloc, ce sont les pointages à valider — voyez le sujet sur la validation des journées.",
      "Le deuxième liste les nouveaux membres de l'entreprise pas encore affectés à un chantier ; touchez-en un pour aller le placer.",
      "Le troisième liste les rappels, chacun avec sa catégorie et son échéance ; touchez-le pour ouvrir la note, ou « Ignorer » pour l'effacer.",
      "Quand rien n'est dû, la feuille le dit simplement.",
    ],
    whoCanDoIt:
      "Tout le monde voit la cloche ; ce qu'elle contient dépend de vous. Les pointages vont à ceux qui gèrent les présences, les nouveaux membres aux administrateurs de société.",
    gotchas: [
      "Les nouveaux membres ne sont pas encore comptés dans le point : celui-ci peut donc sous-estimer ce qui attend.",
      "C'est la cloche des validations. Les notifications push qui arrivent sur votre téléphone se règlent ailleurs, dans Paramètres → Notifications.",
    ],
  },
  {
    id: "settings",
    title: "Paramètres, moyens de paiement et rôles",
    purpose:
      "Votre compte, vos sociétés et les listes dont se sert tout le reste de l'application : moyens de paiement, rôles main-d'œuvre et notifications reçues sur ce téléphone.",
    steps: [
      "Touchez vos initiales, puis « Paramètres ».",
      "« Moyens de paiement » nomme les façons de payer les factures d'une société. Saisissez un nom et touchez « Ajouter » ; touchez-en un pour le renommer. « Espèces » est intégré et ne peut pas être supprimé.",
      "« Rôles main-d'œuvre » contient les rôles que vous attribuez aux ouvriers, chacun avec sa couleur. Touchez « Nouveau rôle », nommez-le, choisissez une couleur et enregistrez.",
      "« Notifications » choisit les notifications push qui arrivent sur ce téléphone : un interrupteur général, puis discussion d'équipe, présences, tâches, équipe et accès, et argent.",
      "« Mes sociétés » liste les sociétés auxquelles vous êtes rattaché. Les administrateurs peuvent modifier les informations légales, distribuer des codes société et des jetons d'invitation, gérer les utilisateurs rattachés et supprimer la société.",
      "« Fusionner des personnes » fond un doublon dans la bonne personne et lui transfère ses ouvriers.",
      "Le bas de l'écran porte la version de l'application et « Se déconnecter ».",
    ],
    whoCanDoIt:
      "Tout le monde accède aux Paramètres. Modifier les moyens de paiement demande d'administrer la société. Les choix de notification sont propres à ce téléphone.",
    gotchas: [
      "Les compteurs et le nom de société affichés sur les lignes des paramètres viennent de votre première société, pas du chantier sélectionné.",
      "Retirer un moyen de paiement ne change rien aux factures existantes ; cela empêche seulement les nouvelles de l'utiliser.",
    ],
  },
  {
    id: "worker-attendance",
    title: "Déclarer vos journées travaillées",
    purpose:
      "En tant qu'ouvrier, vous déclarez les journées passées sur le chantier et vous attendez que votre responsable les valide.",
    steps: [
      "Choisissez le jour que vous déclarez — le calendrier se trouve sous la carte de pointage.",
      "Choisissez votre poste : journée, demi-journée ou heures sup.",
      "Touchez « Pointer ce jour ». L'envoi est immédiat, et votre responsable est prévenu qu'une validation l'attend.",
      "Sur une journée déjà déclarée, touchez « Modifier ce jour » pour changer le poste, le supplément d'heures ou la note.",
      "Tant qu'elle est en attente, votre modification est enregistrée directement ; une fois la journée validée, le même bouton envoie une demande de modification.",
      "Les badges vous disent où en est chaque jour : en attente, validé, ou modification demandée avec ce que vous avez demandé.",
      "Plus bas : vos jours, ce que vous avez gagné et ce qui est encore en attente pour le mois, ainsi que les autres personnes présentes ce jour-là.",
    ],
    whoCanDoIt:
      "Vous, sur le chantier sélectionné, à condition que votre compte soit relié à une fiche ouvrier. Sinon, l'écran vous dit de demander à votre responsable.",
    workerMode: true,
    gotchas: [
      "Vous pouvez déclarer aujourd'hui ou un jour passé qui n'a pas encore de saisie ; un jour à venir est refusé.",
      "La liste de l'équipe montre les noms, la présence et les heures, jamais la paie de qui que ce soit, sauf si vous avez le droit de voir la paie.",
    ],
  },
  {
    id: "worker-salary",
    title: "Votre paie sur ce chantier",
    purpose:
      "Ce que vous avez gagné sur ce chantier, ce qui a été payé, et ce qui reste dû, mois par mois.",
    steps: [
      "Ouvrez l'onglet Salaire.",
      "Lisez les totaux : gagné, payé et reste à payer.",
      "Chaque carte de mois affiche son statut, les jours travaillés, et ce qui a été gagné, payé et reste dû.",
      "Les paiements que vous avez reçus sont listés sous chaque mois.",
    ],
    whoCanDoIt:
      "Vous, en lecture seule. Seul un admin ou un manager peut modifier le statut de paiement d'un mois.",
    workerMode: true,
  },
  {
    id: "worker-profile",
    title: "Votre profil et votre taux journalier",
    purpose:
      "Qui vous êtes sur ce chantier et comment votre taux journalier a évolué.",
    steps: [
      "Ouvrez l'onglet Profil.",
      "Lisez votre nom, votre rôle, votre téléphone et le chantier sur lequel vous êtes.",
      "« Taux journalier actuel », c'est ce que vous rapporte aujourd'hui chaque journée travaillée.",
      "« Historique du taux » liste votre taux de départ et chaque changement depuis, en indiquant ceux qui sont appliqués et ceux qui prennent effet bientôt, avec l'augmentation ou la baisse à chaque fois.",
    ],
    whoCanDoIt:
      "Vous, en lecture seule. Changer un taux demande le droit de gérer les présences, précisément ce que cette vue n'a pas.",
    workerMode: true,
  },
];

/** The panel's own labels in this language. */
export const helpChromeFr: HelpChrome = {
  title: "Comment fonctionne Folio",
  subtitle: "Tous les processus, étape par étape.",
  back: "Tous les sujets",
  steps: "Étapes",
  whoCanDoIt: "Qui peut le faire",
  gotchas: "Bon à savoir",
  webOnly: "Sur l'application web",
  workerBadge: "Vue ouvrier",
};

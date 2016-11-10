# System for crash-to-bucket assignment.
OPL - Thème 2: Crash Analysis  
15/11/2016

## Auteurs
Benjamin Coenen - Nicolas Delperdange

## Table des matières
**[Introduction](#introduction)**  
**[Contexte et Problème](#contexte-et-problème)**  
**[Travail technique](#travail-technique)**  
**[Evaluation](#evaluation)**  
**[Limitation](#limitation)**  
**[Conclusion](#conclusion)**  
**[Glossaire](#glossaire)**

## Introduction
Dans le cadre d'un challenge pour le cours d'OPL de l'Université de Lille 1, nous devons réunir des stacktraces (capturées dans des issues Github) dans un même bucket.  
Un Bucket est donc un ensemble de stacktrace qui sont liées au même problème.

![Stacktrace](https://raw.githubusercontent.com/Oupsla/StacktraceCrawler/master/images/Bucket.png)

Le but étant donc pour le débuggeur de ne pas devoir traiter plusieurs fois le même problème.  
Avant toute chose il faut définir quelques points essentiels d'une stacktrace :

![Stacktrace](https://raw.githubusercontent.com/Oupsla/StacktraceCrawler/master/images/Stacktrace.png)

- Une stacktrace est composée d'un ensemble de frames
- Une frame correspond à un appel de méthode ou procédure et est composée de :
  - Un numéro de frame
  - Une adresse
  - Un nom de méthode
  - Un chemin
  - Et différents paramètres


## Contexte et Problème
Comme tout bon étudiant en informatique et plus particulièrement en génie logiciel, nous avons d'abord parcouru la toile à la recherche de solutions existantes.
Afin d'un côté s'en inspirer et pourquoi pas les intégrer dans notre projet.

Après quelques heures de recherches, de discussions et d'essais, nous avons réuni 3 projets : 2 outils de gestion de bugs et un papier de Microsoft.

### Sentry / Rollbar
Sentry et Rollbar **[[2-3]](#référence)** sont tous les 2 des gestionnaires de crashs et intègrent un système de triage de stacktrace.
Sentry est open-source et est disponible sur Github et Rollbar possède une bonne documentation en ligne mais n'est malheureusement pas open-source.

Ces 2 programmes étant très proche de la réalité, nous avons donc parcouru leur documentation à la recherche de bonnes pratiques concernant le groupage d'exception.

Rollbar applique une méthode de tri qui consiste à comparer des empreintes de stacktrace.
Pour cela il procède comme ce qui suit :
 - Combiner tous les noms de fichiers et noms de méthodes des stacktraces
 - Enlever à cela les dates, sha et entiers de plus de 2 caractères
 - Ajouter le nom de classe d'exception
 - Produire une empreinte SHA1 de cette concaténation

Il leur suffit ensuite de comparer les empreintes des stacktraces, si celle-ci sont égales, les stackstraces appartiennent au même bucket.

Sentry lui invoque le fait qu'il ne peut stocker tous les stacktraces qui lui sont fournis et donc essaye de ne stocker qu'une seul stacktrace par bucket et donc essaye de stocker la stacktrace la plus représentative du bucket.

### Rebucket de Microsoft
Ce projet **[[5]](#référence)** n'est pas un logiciel mais un papier expliquant la méthode de Microsoft pour assembler des rapports de crash par rapport à la similarité des stacktraces jointes.
Ce papier nous a permis d'affiner notre algorithme de tri en y rajoutant des concepts fort intéressants !

#### Les fonctions récursives et immunes
Cette étape de pre-processing consiste à enlever les frames qui possèdent des appels récursifs pour ne garder qu'un appel.  
Sinon cela causerait un mauvais calcul par la suite dû a la duplication des méthodes.

Pendant cette étape, ils enlevent aussi les fonctions immunes, c'est-à-dire, des fonctions qui ne 'peuvent' provoquer de bugs car celles-ci ont été testés de maintes fois.

#### La distance et l'offset
Le premier concept est la distance et l'offset d'une frame.  

La distance est la position de la frame courante par rapport à la première frame (top frame).  
L'offset est la différence de niveau entre 2 frames dans des stacktraces différentes.

![Stacktrace](https://raw.githubusercontent.com/Oupsla/StacktraceCrawler/master/images/Distance.png)

#### 'The Position Dependent Model'
Ce concept introduit par Rebucket est une formule permettant de calculer la similarité entre 2 stacktraces et est basée sur les métriques précédentes :

- Plus de points doivent être accordés aux frames dont la position est proche du top, puisque la frame qui est à l'origine du bug est souvent proche du top.  
- Et l'offset entre 2 fonctions semblables provenant du même bug est censé proche de 0.

Et grâce à ces 2 principes et le nombre de frames semblables entre 2 stacktraces, ils calculent un coefficient de similarité découlant d'une formule mathématique et de paramètres fixés (ou calculés grâce à des buckets validés).

Ils assemblent ensuite les stacktraces dans des buckets sur un principe de distance basée sur cette similarité.

## Travail technique
### But

Tout le but de ce travail consiste donc à créer le 'meilleur' algorithme pour assembler les bonnes stacktraces dans les bons buckets.  
Evidemment il est impossible d'obtenir un score de 100%, car même l'être humain ne peut être sûr en regardant 2 stacktraces que celle-ci découlent du même problème avec certitude car trop de facteurs non-prévisible entrent en jeu.

### Architecture
Nous avons utilisé une architecture basée sur NodeJs par soucis de facilité d'écriture et d'utilisation.  
Nous avons aussi fortement découpé notre code en multiples méthodes afin de le rendre très maléable, le projet étant découpé principalement en 2 fichiers :
- index.js, qui s'occupe du calcul du score et du regroupement en bucket
- parse.js, qui s'occupe de tout le traitement des fichiers et chaînes de caractères (lecture, récupération, nettoyage, ...)

Concernant les librairies utilisées : 
- Bluebird : librairie permettant d'utiliser des 'promises' (système asynchrone) **[[6]](#référence)**
- Crypto : librairie de cryptographie pour calculer le SHA1 des stacktraces **[[7]](#référence)**
- Mathjs : librairie mathématique avec fonctions avancées **[[8]](#référence)**
- fs : librairie de lecture de fichier intégrée à Nodejs **[[9]](#référence)**


### Algorithme
Notre algorithme se décompose en 3 étapes :
- Pré-processing
- Calcul de la similitude 
- Groupage en bucket

![AlgoBucket](https://raw.githubusercontent.com/Oupsla/StacktraceCrawler/master/images/AlgoBucket.png)

#### Pré-Processing
La première étape est donc une étape de pré-processing, elle consiste à lire toutes les stacktraces et buckets existants et à en extraire les données utiles.  
Pour cela nous utilisons la librairie FS afin de lire les différents fichiers auxquels nous appliquons de multiples regex afin d'enlever les informations inutiles et en tirer les informations suivantes :
- Le nom de méthodes de toutes les frames
- Le chemin de la méthode de toutes les frames
- Le numéro de chaque frame

Avant de faire cela, nous enlevons les méthodes récursives car celles-ci peuvent introduire des erreurs de calculs de similarité par le suite et aussi les fonctions immunes qui sont *réputées* pour ne pas provoquer de bugs (comme la méthode *clone()*) et qui dont ne doivent pas entrer dans le calcul de similarité.

Concernant les informations retirées, nous enlevons :
- Les paramètres (différents paramètres pouvant amener au même bug)
- Les numéros de lignes (pouvant trop facilement varier)
- Les numéros de version de librairies
- Les méthodes anonymes ne pouvant pas être comparées

Nous obtenons donc au final de cette étape un tableau contenant les différentes frames de chaque stacktraces afin de pouvoir les comparer aisément.

#### Similitude



#### Groupage



### Utilisation

### Screenshots

## Evaluation

## Limitation

## Conclusion

## Glossaire

## Référence :
- [1] Crashwalk : https://github.com/bnagy/crashwalk
- [2] AFL : http://lcamtuf.coredump.cx/afl/ & https://en.wikipedia.org/wiki/American_fuzzy_lop_(fuzzer)
- [3] Sentry : https://sentry.io/welcome/ & https://github.com/getsentry/sentry
- [4] Rollbar : https://rollbar.com/
- [5] Rebucket : https://www.microsoft.com/en-us/research/publication/rebucket-a-method-for-clustering-duplicate-crash-reports-based-on-call-stack-similarity/
- [6] Bluebird : https://github.com/petkaantonov/bluebird
- [7] Crypto : https://github.com/Gozala/crypto
- [8] Mathjs : http://mathjs.org/
- [9] FS : https://nodejs.org/api/fs.html


## Annexe : 

### Crashwalk de bnagy

*N'ayant pu retirer quelque chose de concret de ce projet, nous avons préféré déplacer celui-ci en Annexe.*  

Ce projet **[[1]](#référence)** a pour vocation de trier les crashs disque de Linux et de les trier dans différentes buckets.
Celui-ci est écrit en Go et une partie en Python.

Il nous a fait découvrir le projet "american fuzzy lop (fuzzer) (AFL)" **[[2]](#référence)** qui est un algorithme permettant d'augmenter la couverture des tests.
AFL demande à lutilisateur de fournir un exemple de commande qui teste l'application et un petit exemple de fichier d'entrée.

Après cette phase initiale, AFL commence le processus actuel de 'fuzzing' en appliquant différentes modifications au fichier d'entrée. Quand le programme crash, cella suggère un potentiel nouveau bug ou même une faille de sécurité. Il enregistre donc le fichier d'entrée utilisé pour inspection future.

Voici un exemple de modification d'image par AFL :

![Stacktrace](https://raw.githubusercontent.com/Oupsla/StacktraceCrawler/master/images/AFL_Fuzz_Logo.gif)

Malgré l'intéret pour ce projet et AFL, nous n'avons pas pu en retirer quelque chose d'intéressant pour notre problème actuel car l'algorithme de tri était trop spécifique aux crashs disque.


## Historique :

- Version 1 (fuzzy - 3heures) : 0
- Version 2 (homemade - 15886.117ms): 22
- Version 3 (homemade + address - 36440.523ms): 23
- Version 4 (homemade + address + score for unknown method or path - 51045.092ms): 27
- Version 5 (+ métriques de distance top - 98183.193ms) : 32
- Version 6 (+ métrique offset - 115283.663ms) : 33
- Version 7 (+ enlever les fonctions récursives - 23141.745ms) : 32
- Version 8 (+ SHA1 - 34978.063ms) : 32
- Version 9 (+ enlever immunes - 3781.552ms) : 30
- Version 10 (coup dur : fix path in method - désactivation des métriques distance - 10804.055ms) : 31
- Version 11 (Rebucket Algo similarity - 49422.940ms) : 43
- Version 12 (better coeffs + removing version lib - 38022.126ms) : 44

## Améliorations :

- Possibilité d'add/remove des fonctionnalités
- Brute force avec les buckets qu'on connait deja
- Essayer de trouver de meilleurs valeurs (c, o et de comparaisons)
- Ajouter la stacktrace traité au tableau des buckets
- Repasser plusieurs fois l'algo pour affiner

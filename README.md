# System for crash-to-bucket assignment.
OPL - Thème 2: Crash Analysis  
xx/11/2016

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

Après quelques heures de recherches, de discussions et d'essais, nous avons réuni 3 projets :


### Crashwalk de bnagy
Ce projet a pour vocation de trier les crashs disque de Linux et de les trier dans différentes buckets.
Celui-ci est écrit en Go et une partie en Python.

Il nous a fait découvrir le projet "american fuzzy lop (fuzzer) (AFL)" qui est un algorithme permettant d'augmenter la couverture des tests.
AFL demande à l’utilisateur de fournir un exemple de commande qui teste l'application et un petit exemple de fichier d'entrée.

Après cette phase initiale, AFL commence le processus actuel de 'fuzzing' en appliquant différentes modifications au fichier d'entrée. Quand le programme crash, cella suggère un potentiel nouveau bug ou même une faille de sécurité. Il enregistre donc le fichier d'entrée utilisé pour inspection future.

Voici un exemple de modification d'image par AFL :

![Stacktrace](https://raw.githubusercontent.com/Oupsla/StacktraceCrawler/master/images/AFL_Fuzz_Logo.gif)

Malgré l'intéret pour ce projet et AFL, nous n'avons pas pu en retirer quelque chose d'intéressant pour notre problème actuel car l'algorithme de tri était trop spécifique aux crashs disque.


### Sentry / Rollbar
Sentry et Rollbar sont tous les 2 des gestionnaires de crashs et intègrent un système de triage de stacktrace.
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
Ce projet n'est pas un logiciel mais un papier expliquant la méthode de Microsoft pour assembler des rapports de crash par rapport à la similarité des stacktraces jointes.
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

### Architecture

### Algorithme

### Utilisation

### Screenshots

## Evaluation

## Limitation

## Conclusion

## Glossaire

## Référence :
- Crashwalk : https://github.com/bnagy/crashwalk
- AFL : http://lcamtuf.coredump.cx/afl/ & https://en.wikipedia.org/wiki/American_fuzzy_lop_(fuzzer)
- Sentry : https://sentry.io/welcome/ & https://github.com/getsentry/sentry
- Rollbar : https://rollbar.com/
- Rebucket : https://www.microsoft.com/en-us/research/publication/rebucket-a-method-for-clustering-duplicate-crash-reports-based-on-call-stack-similarity/


## Historique :

- Version 1 (fuzzy - 3heures) : 0
- Version 2 (homemade - 15886.117ms): 22
- Version 3 (homemade + address - 36440.523ms): 23
- Version 4 (homemade + address + score for unknown method or path - 51045.092ms): 27
- Version 5 (+ métriques de distance top - 98183.193ms) : 32
- Version 6 (+ métrique offset - 115283.663ms) : 33
- Version 7 (+ enlever les fonctions récursives - 23141.745ms) : 32
- Version 8 (+ SHA1 - 34978.063ms) : 32

## Améliorations :
- Ajouter la stacktrace traité au tableau des buckets
- Repasser plusieurs fois l'algo pour affiner
- Vérifier le problème de parser
- Vérifier la moyenne
- Filtre avancée
- Sha1 (concatener nom de methode et path > comparer les sha1)
  - Enlever les dates et sha des méthodes et path
  - Enlever les integers de plus de 2 caractères
- Enlever les fonctions immunes (comme clone())
- Implementer la formule de calcul de Rebucket pour la similarité
- Implementer le Agglomerative Hierarchical clustering technique 

# System for crash-to-bucket assignment.

OPL - Thème 2: Crash Analysis

xx/11/2016

Benjamin Coenen - Nicolas Delperdange


## Historique :

Version 1 (fuzzy - 3heures) : 0
Version 2 (homemade - 15886.117ms): 22


Improve :
- Ajouter la stacktrace traité au tableau des buckets*
- Vérifier le problème de parser
- Vérifier la moyenne
- Filtre avancée
- Sha1

## Table des matières
**[Introduction](#introduction)**  
**[Travail technique](#travail-technique)**  
**[Evaluation](#evaluation)**  
**[Limitation](#limitation)**  
**[Conclusion](#conclusion)**  
**[Glossaire](#glossaire)**

## Introduction


### Contexte/Problème


### Solution




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
- Bucket : Un bucket est un rassemblement de plusieurs stacktraces dont la source du bug est la même

## Notes

Expliquez nos recherches :
- Algo de Microsoft
- Sentry / Rollbar
- https://github.com/bnagy/crashwalk Bucket and triage on-disk crashes. OSX and Linux.

Parlez de leur performance, utilité, ce qu'on a repris pour notre algo.



Fonctionnement :

Comparer la stacktrace avec chaque bucket ce qui résulte en un score de comparaison
pour chaque stacktrace contenu dans chaque bucket.

Ensuite associer la stacktrace par rapport au plus haut résultat obtenu (moyenne ou plus haut score)


Pour calculer le score :
- Comparer chaque ligne d'une stacktrace avec chaque ligne d'une autre stacktrace
- Points :
  - Si même nom de méthode : 1 Point
  - Si même path : 2 Points
  - Si même nom de méthode/path : 4 Points

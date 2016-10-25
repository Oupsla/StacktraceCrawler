# TraceCrawler


Expliquez nos recherches :
- Algo de Microsoft
- Sentry / Rollbar
- https://github.com/bnagy/crashwalk Bucket and triage on-disk crashes. OSX and Linux.

Parlez de leur performance, utilité, ce qu'on a repris pour notre algo.



Fonctionnement :

Comparer la stacktrace avec chaque bucket ce qui résulte en un score de comparaison
pour chaque stacktrace contenu dans chaque bucket.

Ensuite associer la stacktrace par rapport au plus haut résultat obtenu (moyenne ou plus haut score)

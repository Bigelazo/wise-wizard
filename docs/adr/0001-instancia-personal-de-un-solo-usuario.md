# Instancia personal de un solo usuario

El MVP sirve a un único estudiante, que además es quien desarrolla la app: no hay registro, roles ni colaboración. Aun así, las entidades raíz guardan un dueño (`ownerId`), de modo que pasar a multiusuario sea una migración y no una reescritura (ver ADR-0010).

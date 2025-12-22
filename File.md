Current situation.

This repo is a monorepo frontend vanlia html with a backend in express javascript

The backend is hosted on Render under Roni's account (Node js Express), all the enviroment varabiles are defeind in the render
https://conet-backend.onrender.com/
For every new commit on the main branch a new version will build itself and deploy it.
You can view the build logs!
https://dashboard.render.com/web/srv-d545746r433s73coj0q0

The Frontend is hosted on Github pages: https://roni-lichtig.github.io/CoNet_Project

The frontend rebuilds itself by the deploy-frontend.yml rules, if the build fails a new version will not go up
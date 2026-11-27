FROM safeword-harbor-proof-base:1.1.0
WORKDIR /app
RUN unlink public-test.mjs && npm pkg delete scripts.test
COPY task.mjs ./

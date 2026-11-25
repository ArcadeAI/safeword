FROM node:22-bookworm
COPY --from=ghcr.io/astral-sh/uv:0.12.9 /uv /usr/local/bin/uv
RUN npm install -g bun@1.4.4 @anthropic-ai/claude-code@2.1.326
WORKDIR /app
ADD snapshot.tar.gz /app/
RUN cd apps/worker/toolkits/microsoft_outlook_mail && uv sync --frozen --extra dev --python 3.13.15
RUN git init -b main && printf '.venv/\n__pycache__/\n' >> .git/info/exclude && \
    git add -A && git -c user.name=Harbor -c user.email=fixture@example.invalid commit -qm "Frozen fixture"

# The workstation image. Its contract is in #32.
FROM public.ecr.aws/docker/library/node:24-bookworm-slim

# AgentCore's group on the instance.
ARG WORKSTATION_GID=65536
ARG WORKSTATION_UID=1001
ARG AWS_CLI_VERSION=2.37.9
# The npm package pins reliably; its postinstall swaps in the native arm64 binary.
ARG CLAUDE_CODE_VERSION=2.1.289
ARG WS_VERSION=8.22.0

# util-linux provides `script`, which gives the terminal its PTY.
RUN apt-get update \
  && apt-get install -y --no-install-recommends git curl ca-certificates unzip util-linux \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-aarch64-${AWS_CLI_VERSION}.zip" -o /tmp/awscliv2.zip \
  && unzip -q /tmp/awscliv2.zip -d /tmp \
  && /tmp/aws/install \
  && rm -rf /tmp/awscliv2.zip /tmp/aws

# The seed: server.mjs copies it into HOME at startup, because HOME is a volume mounted at runtime.
RUN npm install -g --prefix /opt/claude-code "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
  && npm cache clean --force

WORKDIR /opt/workstation
RUN npm install --omit=dev --no-save --no-package-lock --prefix /opt/workstation "ws@${WS_VERSION}" \
  && npm cache clean --force
# The construct stages the caller's startup script as startup.sh next to this file.
COPY --chmod=755 server.mjs startup.sh* /opt/workstation/

RUN groupadd -g $WORKSTATION_GID agentcore-runtime-user \
  && useradd -u $WORKSTATION_UID -g $WORKSTATION_GID -M -d /mnt/workspace/home -s /bin/bash box

# /mnt/workspace is WORKSPACE_MOUNT_PATH in src/workstation.ts; the volume is mounted there.
ENV HOME=/mnt/workspace/home
# A non-numeric USER breaks the overlay mount on images with many layers.
USER $WORKSTATION_UID:$WORKSTATION_GID
EXPOSE 8080
CMD ["node", "/opt/workstation/server.mjs"]

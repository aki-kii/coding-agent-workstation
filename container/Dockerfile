# The workstation image. Its contract is in #32.
FROM public.ecr.aws/docker/library/node:24-bookworm-slim

# AgentCore's group on the instance.
ARG WORKSTATION_GID=65536
ARG WORKSTATION_UID=1001
ARG AWS_CLI_VERSION=2.37.9
ARG CLAUDE_CODE_VERSION=2.1.289
ARG WS_VERSION=8.22.0

# util-linux provides `script`, which gives the terminal its PTY. The AWS CLI pages through less.
RUN apt-get update \
  && apt-get install -y --no-install-recommends git curl ca-certificates unzip util-linux less \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-aarch64-${AWS_CLI_VERSION}.zip" -o /tmp/awscliv2.zip \
  && unzip -q /tmp/awscliv2.zip -d /tmp \
  && /tmp/aws/install \
  && rm -rf /tmp/awscliv2.zip /tmp/aws

# The seed: server.mjs copies it into HOME at startup, because HOME is a volume mounted at runtime.
# The native installer, into a HOME of its own, so that the seed has the same layout as a
# native install in the real HOME.
RUN curl -fsSL https://claude.ai/install.sh | HOME=/opt/claude-code bash -s "${CLAUDE_CODE_VERSION}" \
  && HOME=/opt/claude-code /opt/claude-code/.local/bin/claude --version

WORKDIR /opt/workstation
RUN npm install --omit=dev --no-save --no-package-lock --prefix /opt/workstation "ws@${WS_VERSION}" \
  && npm cache clean --force
# The construct stages the caller's startup script as startup.sh next to this file. COPY
# --chmod needs BuildKit, which not every builder has.
COPY server.mjs startup.sh* /opt/workstation/
RUN if [ -f startup.sh ]; then chmod 755 startup.sh; fi

# The terminal runs a login shell, and /etc/profile resets PATH. HOME has no .profile of its own.
RUN echo 'PATH="$HOME/.local/bin:$PATH"' > /etc/profile.d/workstation.sh

RUN groupadd -g $WORKSTATION_GID agentcore-runtime-user \
  && useradd -u $WORKSTATION_UID -g $WORKSTATION_GID -M -d /mnt/workspace/home -s /bin/bash box

# /mnt/workspace is WORKSPACE_MOUNT_PATH in src/workstation.ts; the volume is mounted there.
ENV HOME=/mnt/workspace/home
# A non-numeric USER breaks the overlay mount on images with many layers.
USER $WORKSTATION_UID:$WORKSTATION_GID
EXPOSE 8080
CMD ["node", "/opt/workstation/server.mjs"]

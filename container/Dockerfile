# The workstation image. Its contract is still being designed (#32); this is the smallest
# version that a runtime accepts.
FROM public.ecr.aws/docker/library/node:24-bookworm-slim

# AgentCore's group on the instance.
ARG WORKSTATION_GID=65536
ARG WORKSTATION_UID=1001

RUN groupadd -g $WORKSTATION_GID agentcore-runtime-user \
  && useradd -u $WORKSTATION_UID -g $WORKSTATION_GID -M -d /mnt/workspace/home -s /bin/bash box

COPY server.mjs /opt/workstation/server.mjs

ENV HOME=/mnt/workspace/home
# A non-numeric USER breaks the overlay mount on images with many layers.
USER 1001:65536
EXPOSE 8080
CMD ["node", "/opt/workstation/server.mjs"]

import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export function errorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error.validation) {
    reply.status(400).send({
      code: 'INVALID_PLAN',
      message: 'Validation error',
      details: error.validation,
    });
    return;
  }

  const status = error.statusCode ?? 500;
  reply.status(status).send({
    code: 'NETWORK_ERROR',
    message: error.message ?? 'Internal server error',
  });
}

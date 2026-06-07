import prisma from '../config/prisma';

interface PaginateOptions {
  page?: number;
  limit?: number;
  where?: Record<string, unknown>;
  include?: Record<string, unknown>;
  orderBy?: Record<string, unknown> | Record<string, unknown>[];
  select?: Record<string, unknown>;
}

export const paginate = async <T>(
  model: { findMany: (args: unknown) => Promise<T[]>; count: (args: unknown) => Promise<number> },
  options: PaginateOptions
) => {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    model.findMany({
      where: options.where,
      include: options.include,
      orderBy: options.orderBy,
      select: options.select,
      skip,
      take: limit,
    }),
    model.count({ where: options.where }),
  ]);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    },
  };
};

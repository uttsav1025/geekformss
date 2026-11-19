import type { Response } from "express";

/** Pagination metadata. A sibling of `data`, never nested inside it. */
export interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface FieldError {
  field: string;
  message: string;
}

// The three response shapes. Never invent a fourth.
export const sendSuccess = <T>(res: Response, data: T, message = "Success", statusCode = 200) => {
  res.status(statusCode).json({ success: true, data, message });
};

export const sendPage = <T>(res: Response, data: T[], meta: Meta, message = "Success") => {
  res.status(200).json({ success: true, data, meta, message });
};

export const sendError = (res: Response, statusCode = 500, message = "Internal Server Error", errors?: FieldError[]) => {
  res.status(statusCode).json({ success: false, data: null, message, ...(errors && { errors }) });
};

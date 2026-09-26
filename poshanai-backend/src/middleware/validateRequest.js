export default function validateRequest(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body ?? {}, {
      abortEarly: false,
      convert: true,
      stripUnknown: false,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details.map(({ message }) => message).join('; '),
        },
      });
    }

    req.body = value;
    return next();
  };
}

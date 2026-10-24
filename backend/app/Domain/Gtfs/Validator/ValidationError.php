<?php

declare(strict_types=1);

namespace App\Domain\Gtfs\Validator;

final readonly class ValidationError
{
    public function __construct(
        public string $file,
        public int $row,
        public ?string $column,
        public string $code,
        public string $message,
        public string $severity = 'error',
        public ?string $value = null,
    ) {
    }

    /** @return array<string, int|string|null> */
    public function toArray(): array
    {
        return [
            'file_name' => $this->file,
            'row_number' => $this->row,
            'column_name' => $this->column,
            'code' => $this->code,
            'severity' => $this->severity,
            'value' => $this->value,
            'message' => $this->message,
        ];
    }
}

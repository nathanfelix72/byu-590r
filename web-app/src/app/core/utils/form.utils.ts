import { FormGroup } from '@angular/forms';

export function setFormErrors(
  form: FormGroup,
  errors: { [key: string]: string[] }
): void {
  Object.keys(errors).forEach((key) => {
    const control = form.get(key);
    if (control) {
      const errorMessage = Array.isArray(errors[key])
        ? errors[key][0]
        : errors[key];
      control.setErrors({ serverError: errorMessage });
      control.markAsTouched();
    }
  });
}

export function clearFormErrors(form: FormGroup): void {
  Object.keys(form.controls).forEach((key) => {
    const control = form.get(key);
    if (control) {
      const errors = control.errors;
      if (errors && errors['serverError']) {
        delete errors['serverError'];
        control.setErrors(Object.keys(errors).length > 0 ? errors : null);
      }
    }
  });
}

export function getFieldError(
  form: FormGroup,
  fieldName: string
): string | null {
  const control = form.get(fieldName);
  if (control && control.errors) {
    if (control.errors['serverError']) {
      return control.errors['serverError'];
    }
    if (control.touched) {
      if (control.errors['required']) {
        return `${fieldName} is required`;
      }
      if (control.errors['min']) {
        return `${fieldName} must be at least ${control.errors['min'].min}`;
      }
    }
  }
  return null;
}


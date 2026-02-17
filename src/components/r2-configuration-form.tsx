import { Action, ActionPanel, Form, Icon, showToast, Toast } from "@raycast/api";
import { useState } from "react";
import { normalizeConfiguration, validateConfiguration, validateR2Connection } from "../lib/r2";
import { setR2Configuration } from "../lib/storage";
import type { R2Configuration } from "../types";

type ConfigurationFormValues = {
  r2Endpoint: string;
  r2Bucket: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  publicBaseUrl: string;
  objectPrefix?: string;
};

type Props = {
  initialValues?: Partial<R2Configuration>;
  allowCancel: boolean;
  onCancel?: () => void;
  onSaved: (configuration: R2Configuration) => void;
};

function toFormValues(initialValues?: Partial<R2Configuration>): ConfigurationFormValues {
  return {
    r2Endpoint: initialValues?.r2Endpoint ?? "",
    r2Bucket: initialValues?.r2Bucket ?? "",
    r2AccessKeyId: initialValues?.r2AccessKeyId ?? "",
    r2SecretAccessKey: initialValues?.r2SecretAccessKey ?? "",
    publicBaseUrl: initialValues?.publicBaseUrl ?? "",
    objectPrefix: initialValues?.objectPrefix ?? "",
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Configuration validation failed";
}

export function R2ConfigurationForm(props: Props) {
  const { initialValues, onSaved, onCancel, allowCancel } = props;
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(values: ConfigurationFormValues) {
    setIsSubmitting(true);

    const configCandidate: R2Configuration = {
      r2Endpoint: values.r2Endpoint,
      r2Bucket: values.r2Bucket,
      r2AccessKeyId: values.r2AccessKeyId,
      r2SecretAccessKey: values.r2SecretAccessKey,
      publicBaseUrl: values.publicBaseUrl,
      objectPrefix: values.objectPrefix,
    };

    const errors = validateConfiguration(configCandidate);
    if (errors.length > 0) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Invalid configuration",
        message: errors[0],
      });
      setIsSubmitting(false);
      return;
    }

    const normalized = normalizeConfiguration(configCandidate);
    const validatingToast = await showToast({
      style: Toast.Style.Animated,
      title: "Validating R2 connection...",
    });

    try {
      await validateR2Connection(normalized);
      await setR2Configuration(normalized);
      validatingToast.style = Toast.Style.Success;
      validatingToast.title = "Configuration saved";
      validatingToast.message = "R2 connection validated";
      onSaved(normalized);
    } catch (error) {
      validatingToast.style = Toast.Style.Failure;
      validatingToast.title = "Configuration failed";
      validatingToast.message = getErrorMessage(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  const defaults = toFormValues(initialValues);

  return (
    <Form
      isLoading={isSubmitting}
      navigationTitle="R2 Configuration"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save and Validate" icon={Icon.CheckCircle} onSubmit={handleSubmit} />
          {allowCancel ? <Action title="Back to Gallery" icon={Icon.ArrowLeft} onAction={onCancel} /> : null}
        </ActionPanel>
      }
    >
      <Form.Description
        title="Set Up Cloudflare R2"
        text="Fill in your R2 credentials and public URL. This form validates bucket access before saving."
      />
      <Form.TextField
        id="r2Endpoint"
        title="R2 Endpoint"
        placeholder="https://<accountid>.r2.cloudflarestorage.com"
        defaultValue={defaults.r2Endpoint}
      />
      <Form.TextField id="r2Bucket" title="R2 Bucket" defaultValue={defaults.r2Bucket} />
      <Form.TextField id="r2AccessKeyId" title="R2 Access Key ID" defaultValue={defaults.r2AccessKeyId} />
      <Form.PasswordField
        id="r2SecretAccessKey"
        title="R2 Secret Access Key"
        defaultValue={defaults.r2SecretAccessKey}
      />
      <Form.TextField
        id="publicBaseUrl"
        title="Public Base URL"
        placeholder="https://img.yourdomain.com"
        defaultValue={defaults.publicBaseUrl}
      />
      <Form.TextField id="objectPrefix" title="Object Prefix (Optional)" defaultValue={defaults.objectPrefix} />
    </Form>
  );
}

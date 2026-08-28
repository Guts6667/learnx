interface PluralMessage {
  readonly one: string;
  readonly other: string;
}

export type MessageValue = string | PluralMessage;
export type MessageFragment = Readonly<Record<string, MessageValue>>;

export type TranslationOf<Source extends MessageFragment> = {
  readonly [Key in keyof Source]: Source[Key] extends string
    ? string
    : Source[Key] extends PluralMessage
      ? PluralMessage
      : never;
};

import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export const LAYOUTS = ['image', 'text', 'side', 'title', 'plain'];
export const ITEM_KINDS = ['entry', 'relationship', 'details'];
export const MESSAGE_MAX = 500;
export const DETAIL_SLOTS = 3;

export class NewItemDto {
  @IsOptional()
  @IsIn(ITEM_KINDS, {message: 'kind is not valid'})
  kind?: string;

  @IsOptional()
  @IsUUID('all', {message: 'entry is not valid'})
  entryId?: string;

  @IsOptional()
  @IsUUID('all', {message: 'relationship is not valid'})
  relationshipId?: string;

  @IsOptional()
  @IsArray({message: 'details must be a list'})
  @ArrayMaxSize(DETAIL_SLOTS, {message: `Details can fill up to ${DETAIL_SLOTS} spaces`})
  @IsUUID('all', {each: true, message: 'detail is not valid'})
  fieldIds?: string[];

  @IsOptional()
  @IsUUID('all', {message: 'note is not valid'})
  noteId?: string;

  @IsOptional()
  @IsIn(LAYOUTS, {message: 'layout is not valid'})
  layout?: string;

  @IsOptional()
  @IsString({message: 'message must be text'})
  @MaxLength(MESSAGE_MAX, {message: `message can only be up to ${MESSAGE_MAX} characters`})
  message?: string;
}

export class ItemChangeDto {
  @IsOptional()
  @IsUUID('all', {message: 'note is not valid'})
  noteId?: string | null;

  @IsOptional()
  @IsIn(LAYOUTS, {message: 'layout is not valid'})
  layout?: string;

  @IsOptional()
  @IsString({message: 'message must be text'})
  @MaxLength(MESSAGE_MAX, {message: `message can only be up to ${MESSAGE_MAX} characters`})
  message?: string;
}

export class SuggestionDto {
  @IsString({message: 'suggestion must be text'})
  @Matches(/\S/, {message: 'suggestion can not be blank'})
  @MaxLength(2000, {message: 'suggestion can only be up to 2000 characters'})
  body: string;

  @IsOptional()
  @IsUUID('all', {message: 'entry is not valid'})
  entryId?: string;

  @IsOptional()
  @IsBoolean({message: 'anonymous must be true or false'})
  anonymous?: boolean;
}

export class SuggestionStatusDto {
  @IsIn(['open', 'done', 'dismissed'], {message: 'status is not valid'})
  status: 'open' | 'done' | 'dismissed';
}

export class DashboardSettingsDto {
  @IsOptional()
  settings?: object;

  @IsOptional()
  @IsString({message: 'announcement must be text'})
  @MaxLength(1000, {message: 'announcement can only be up to 1000 characters'})
  announcement?: string;
}

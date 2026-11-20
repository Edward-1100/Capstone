import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Req, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WorldRole } from '../common/decorators/world-role.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { WorldRoleGuard } from '../common/guards/world-role.guard';
import { ExportDto } from './dto/export.dto';
import { TransferExportService } from './transfer.export';
import { parseDocument } from './transfer.format';
import { TransferImportService } from './transfer.import';
import { readSelection } from './transfer.manifest';
import { readPlan } from './transfer.plan';

//const UPLOAD = {limits: {fileSize: 250 * 1024 * 1024, fieldSize: 20 * 1024 * 1024, files: 1}};
const UPLOAD = {limits: {fieldSize: Infinity, files: 1}};

function fileName(name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);

  return `${slug || 'world'}-export.json`;
}

function readFile(file: Express.Multer.File | undefined) {
  if (!file) {
    throw new BadRequestException('File is required');
  }

  return parseDocument(file.buffer);
}

@Controller('worlds')
export class TransferController {
  constructor(private readonly exporter: TransferExportService, private readonly importer: TransferImportService) {}

  @Post('import/preview')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', UPLOAD))
  previewNew(@UploadedFile() file: Express.Multer.File) {
    return this.importer.preview(readFile(file), null);
  }

  @Post('import')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', UPLOAD))
  importNew(@Req() req: any, @UploadedFile() file: Express.Multer.File, @Body('plan') plan: string) {
    return this.importer.run(req.user.id, req.user.username, readFile(file), readPlan(plan), null);
  }

  @Get(':id/export')
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  manifest(@Param('id') id: string) {
    return this.exporter.manifest(id);
  }

  @Post(':id/export')
  @HttpCode(200)
  @WorldRole('editor')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  async exportWorld(@Param('id') id: string, @Req() req: any, @Body() dto: ExportDto) {
    const options = dto.options ?? {};
    const built = await this.exporter.build(id, req.user.username, readSelection(dto.select), {images: options.images === true, comments: options.comments === true, notes: options.notes === true});

    return new StreamableFile(Buffer.from(built.content, 'utf8'), {type: 'application/json', disposition: `attachment; filename="${fileName(built.name)}"`});
  }

  @Post(':id/import/preview')
  @HttpCode(200)
  @WorldRole('owner')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  @UseInterceptors(FileInterceptor('file', UPLOAD))
  preview(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.importer.preview(readFile(file), id);
  }

  @Post(':id/import')
  @WorldRole('owner')
  @UseGuards(JwtAuthGuard, WorldRoleGuard)
  @UseInterceptors(FileInterceptor('file', UPLOAD))
  importInto(@Param('id') id: string, @Req() req: any, @UploadedFile() file: Express.Multer.File, @Body('plan') plan: string) {
    return this.importer.run(req.user.id, req.user.username, readFile(file), readPlan(plan), id);
  }
}

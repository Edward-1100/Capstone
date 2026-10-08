import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { DatabaseService } from './database/database.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{provide: DatabaseService, useValue: {query: jest.fn().mockResolvedValue({})}}],
    }).compile();

    appController = app.get(AppController);
  });

  it('should return status ok', async () => {
    expect(await appController.health()).toEqual({status: 'ok'});
  });
});

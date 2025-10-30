import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user (requires organization and workspace)' })
  async register(
    @Body() body: { 
      email: string; 
      password: string; 
      firstName: string; 
      lastName: string;
      organizationId: string; // REQUIRED
      workspaceId: string; // REQUIRED
    },
  ) {
    return this.authService.register(body);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify Keycloak token and sync user' })
  async verifyToken(@Body() body: { token: string }) {
    return this.authService.verifyKeycloakToken(body.token);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user' })
  async getCurrentUser(@Req() req: any) {
    return req.user;
  }
}


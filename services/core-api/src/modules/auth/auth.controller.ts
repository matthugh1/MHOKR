import { Controller, Post, Body, Get, UseGuards, Req, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../../common/types/request.types';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user (requires organization and workspace)' })
  async register(
    @Body() body: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      tenantId: string; // REQUIRED
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
  async getCurrentUser(@Req() req: AuthenticatedRequest) {
    return req.user;
  }
  @Get('azure')
  @UseGuards(AuthGuard('azure-ad'))
  @ApiOperation({ summary: 'Login with Azure AD' })
  async azureLogin() {
    // Initiates the Azure AD login flow
  }

  @Post('azure/callback')
  @UseGuards(AuthGuard('azure-ad'))
  @ApiOperation({ summary: 'Azure AD callback' })
  async azureCallback(@Req() req: any, @Res() res: any) {
    // req.user contains the user returned from validateAzureUser
    // We need to redirect to frontend with the token
    const token = req.user.accessToken;
    // Redirect to frontend callback page
    // TODO: Use ConfigService for frontend URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  }
}


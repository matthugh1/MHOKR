import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MemberRole } from '@prisma/client';

@Injectable()
export class TeamService {
  constructor(private prisma: PrismaService) {}

  async findAll(workspaceId?: string) {
    return this.prisma.team.findMany({
      where: workspaceId ? { workspaceId } : undefined,
      include: {
        workspace: true,
        members: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async findById(id: string) {
    return this.prisma.team.findUnique({
      where: { id },
      include: {
        workspace: true,
        members: {
          include: {
            user: true,
          },
        },
        objectives: true,
      },
    });
  }

  async create(data: { name: string; workspaceId: string }) {
    return this.prisma.team.create({
      data,
    });
  }

  async update(id: string, data: { name?: string }) {
    return this.prisma.team.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.team.delete({
      where: { id },
    });
  }

  async addMember(teamId: string, data: { userId: string; role: string }) {
    return this.prisma.teamMember.create({
      data: {
        teamId,
        userId: data.userId,
        role: data.role as MemberRole,
      },
    });
  }

  async removeMember(teamId: string, userId: string) {
    const teamMember = await this.prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
      },
    });

    if (teamMember) {
      return this.prisma.teamMember.delete({
        where: { id: teamMember.id },
      });
    }

    return null;
  }
}

